// Local-only integration probe. Creates a new synthetic tenant; never resets data.
// Credentials are generated in memory and are never printed or persisted.
const { createRequire } = require('node:module');
const { randomUUID, randomInt } = require('node:crypto');
const req = createRequire('/Users/joelmorales/web/POS-ERP/apps/sync_api/package.json');
const { Pool } = req('pg');
const bcrypt = req('bcrypt');
const localSource = require('node:fs').readFileSync('/Users/joelmorales/web/POS-ERP/apps/sync_api/src/database/connection.ts','utf8');
const connectionString = process.env.DATABASE_URL || localSource.match(/connectionString = process\.env\.DATABASE_URL \|\| '([^']+)'/)[1];
const dbUrl = new URL(connectionString);
if (!['localhost','127.0.0.1'].includes(dbUrl.hostname) || dbUrl.port !== '5432' || dbUrl.pathname !== '/pos_dev' || dbUrl.search) throw Error('Only the local pos_dev database is allowed');
const pool = new Pool({ connectionString });
const base = 'http://127.0.0.1:3000/api';
const ids = Object.fromEntries(['business','branch','otherBranch','owner','operator','otherOperator','category','product','warehouse','table','table2'].map(k => [k,randomUUID()]));
const results = [];
function check(name, actual, expected) { results.push({ name, actual, expected, pass: JSON.stringify(actual) === JSON.stringify(expected) }); }
async function api(path, token, body) {
  const r = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type':'application/json', ...(token ? {Authorization: `Bearer ${token}`} : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await r.json();
  return {status:r.status, data};
}
async function main() {
  const pins = [0,1,2].map(() => String(randomInt(1000,10000)));
  for(let i=1;i<pins.length;i++) while(pins.slice(0,i).includes(pins[i])) pins[i]=String(randomInt(1000,10000));
  const hashes = await Promise.all(pins.map(p => bcrypt.hash(p,10)));
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query('INSERT INTO businesses (id,name) VALUES ($1,$2)',[ids.business,'SYNTHETIC MOR-1 '+ids.business]);
    for(const branch of ['branch','otherBranch']) await c.query('INSERT INTO branches (id,business_id,name) VALUES ($1,$2,$3)',[ids[branch],ids.business,'SYNTHETIC '+branch]);
    for(const [i,user] of ['owner','operator','otherOperator'].entries()) {
      const role = i === 0 ? 'owner' : 'branch_operator';
      await c.query('INSERT INTO users (id,business_id,branch_id,name,pin,role,roles) VALUES ($1,$2,$3,$4,$5,$6,$7)',[ids[user],ids.business,i===2 ? ids.otherBranch : ids.branch,'SYNTHETIC '+user,hashes[i],role,JSON.stringify([role])]);
    }
    await c.query('INSERT INTO categories (id,business_id,name) VALUES ($1,$2,$3)',[ids.category,ids.business,'SYNTHETIC']);
    await c.query('INSERT INTO products (id,business_id,category_id,name,price,cost) VALUES ($1,$2,$3,$4,25,10)',[ids.product,ids.business,ids.category,'SYNTHETIC Empanada']);
    await c.query('INSERT INTO warehouses (id,business_id,name) VALUES ($1,$2,$3)',[ids.warehouse,ids.business,'SYNTHETIC Warehouse']);
    for(const table of ['table','table2']) await c.query('INSERT INTO branch_tables (id,branch_id,label) VALUES ($1,$2,$3)',[ids[table],ids.branch,'SYNTHETIC '+table]);
    await c.query('COMMIT');
  } catch(e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
  const tokens=[];
  for(let i=0;i<3;i++) {
    const r = await api('/auth/tablet-login',null,{businessId:ids.business,branchId:i===2?ids.otherBranch:ids.branch,pin:pins[i],deviceId:'synthetic-mor-1-'+i});
    check('login '+i,r.status,200);
    if(r.status!==200) throw Error('Synthetic login failed');
    tokens.push(r.data.accessToken);
  }
  const [owner,operator,other] = tokens;
  let r = await api('/inventory/stock/adjust',owner,{productId:ids.product,warehouseId:ids.warehouse,quantity:20});
  check('initial warehouse stock',r.status,201);
  r=await api('/inventory/transfers',owner,{businessId:ids.business,fromWarehouseId:ids.warehouse,toBranchId:ids.branch,items:[{productId:ids.product,quantity:10}]});
  check('create transfer',r.status,201);
  const transfer=r.data.transferId;
  r=await api(`/inventory/transfers/${transfer}/ship`,owner,{}); check('dispatch',r.status,201);
  const receipt={items:[{productId:ids.product,quantityReceived:8}]};
  r=await api(`/inventory/transfers/${transfer}/receive`,other,{...receipt,note:'SYNTHETIC shortage'}); check('cross-branch receipt rejected',r.status,400);
  r=await api(`/inventory/transfers/${transfer}/receive`,operator,receipt); check('discrepancy requires note',r.status,400);
  const concurrent=await Promise.all([0,1].map(()=>api(`/inventory/transfers/${transfer}/receive`,operator,{...receipt,note:'SYNTHETIC 2 units missing'})));
  check('concurrent receipt accepted once',concurrent.map(x=>x.status).sort(),[201,400]);
  r=await api(`/inventory/transfers/${transfer}/receive`,operator,{...receipt,note:'SYNTHETIC retry'}); check('sequential duplicate rejected',r.status,400);
  const stock = await pool.query('SELECT sl.branch_id,sl.warehouse_id,w.location_type,SUM(sl.quantity_delta)::float8 AS quantity FROM stock_ledger sl LEFT JOIN warehouses w ON w.id=sl.warehouse_id WHERE sl.business_id=$1 GROUP BY sl.branch_id,sl.warehouse_id,w.location_type',[ids.business]);
  check('warehouse ledger balance',stock.rows.find(x=>x.warehouse_id===ids.warehouse)?.quantity,10);
  check('branch ledger accepted quantity',stock.rows.find(x=>x.branch_id===ids.branch)?.quantity,8);
  check('transit ledger clears',stock.rows.find(x=>x.location_type==='transit')?.quantity,0);
  r=await api('/cash-shifts',operator,{initialFloat:'100.00'}); check('open shift',r.status,201); const shift=r.data.id;
  r=await api(`/cash-shifts/${shift}`,other); check('cross-branch shift rejected',r.status,403);
  for(const [i,method] of ['cash','card'].entries()) {
    const body={clientUuid:randomUUID(),branchId:ids.branch,tableId:i===0?ids.table:ids.table2,waiterId:ids.operator,subtotal:'25.00',total:'25.00',items:[{clientUuid:randomUUID(),productId:ids.product,quantity:1,price:'25.00'}]};
    r=await api('/orders',operator,body); check('save '+method+' order',r.status,201); const order=r.data.id;
    r=await api(`/orders/${order}`,operator); check('saved order remains open '+method,r.data.state,'open');
    if(i===0) { const foreign=await api(`/orders/${order}`,other); check('cross-branch order read rejected',foreign.status,403); const anonymous=await api(`/orders/${order}`,null); check('anonymous order read rejected',anonymous.status,401); }
    if(i===0) {
      const attempts = [
        ['/orders', body],
        [`/orders/${order}/items`, {items:body.items}],
        [`/orders/${order}/billing`, {}],
        [`/orders/${order}/payments`, {amount:'25.00',paymentMethod:'cash'}],
        [`/orders/${order}/cancel`, {reason:'SYNTHETIC forbidden cancellation'}],
        [`/orders/active?branchId=${ids.branch}`, undefined],
        [`/orders/${order}?businessId=${ids.business}`, undefined],
      ];
      for(const [path,payload] of attempts) {
        check('anonymous denied '+path,(await api(path,null,payload)).status,401);
        check('other branch denied '+path,(await api(path,other,payload)).status,403);
      }
      check('owner business listing',(await api(`/orders/active/business?businessId=${ids.business}`,owner)).status,200);
      check('operator business listing denied',(await api(`/orders/active/business?businessId=${ids.business}`,operator)).status,403);
      check('owner foreign business listing denied',(await api(`/orders/active/business?businessId=${randomUUID()}`,owner)).status,403);
      r=await api(`/orders/${order}`,operator); check('denied mutations preserve open order',r.data.state,'open');
      check('denied mutations preserve item count',r.data.items.length,1);
    }
    r=await api(`/orders/${order}/payments`,operator,{amount:'25.00',paymentMethod:method}); check('pay '+method,r.status,200);
    r=await api(`/orders/${order}/payments`,operator,{amount:'25.00',paymentMethod:method}); check('payment retry rejected '+method,r.status,409);
    const count=await pool.query('SELECT count(*)::int AS n FROM payments WHERE order_id=$1',[order]); check('single persisted payment '+method,count.rows[0].n,1);
  }
  r=await api(`/cash-shifts/${shift}/transactions`,operator,{type:'cash-in',amount:'10.00',reason:'SYNTHETIC cash in'}); check('cash in',r.status,201);
  r=await api(`/cash-shifts/${shift}/transactions`,operator,{type:'cash-out',amount:'5.00',reason:'SYNTHETIC cash out'}); check('cash out',r.status,201);
  r=await api(`/cash-shifts/${shift}/close`,operator,{actualAmount:'128.00',closeNotes:'SYNTHETIC two peso shortage'}); check('close shift',r.status,200);
  const rec=r.data.reconciliation || {};
  check('cash sales',rec.cashSales,25); check('card separate',rec.cardSales,25); check('expected cash 100+25+10-5',rec.expectedCash,130); check('cash discrepancy',rec.cashDifference,-2);
  const final=await pool.query('SELECT SUM(quantity_delta)::float8 AS quantity FROM stock_ledger WHERE business_id=$1 AND branch_id=$2',[ids.business,ids.branch]); check('branch stock after two sales',final.rows[0].quantity,6);
}
main().catch(e=>{results.push({name:'probe aborted',pass:false,error:e.code || e.message});}).finally(async()=>{console.log(JSON.stringify({fixture:ids,results},null,2));process.exitCode=results.some(x=>!x.pass)?1:0;await pool.end();});

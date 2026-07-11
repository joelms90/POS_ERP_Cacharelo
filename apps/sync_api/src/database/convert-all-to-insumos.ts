import { db, pool } from './connection';
import * as schema from './schema';
import { eq, and, isNull } from 'drizzle-orm';

async function main() {
  const businessId = process.argv[2];
  if (!businessId) {
    console.error('Por favor, especifique el ID del negocio (businessId) como argumento.');
    process.exit(1);
  }

  console.log(`Convirtiendo todos los productos del negocio ${businessId} a Insumos...`);

  await db
    .update(schema.products)
    .set({
      isSellable: false,
      isIngredient: true,
      updatedAt: new Date()
    })
    .where(
      and(
        eq(schema.products.businessId, businessId),
        isNull(schema.products.deletedAt)
      )
    );

  console.log(`✅ ¡Éxito! Se actualizaron los productos.`);
  await pool.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('Error al realizar la conversión:', err);
  await pool.end();
  process.exit(1);
});

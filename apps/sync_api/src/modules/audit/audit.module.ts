import { Global, Module } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { NotificationsService } from './notifications.service';
import { SupervisorScopeService } from './supervisor-scope.service';

/** Cross-cutting services for spec 019 (audit trail, notifications, supervisor scope). */
@Global()
@Module({
  providers: [AuditLogService, NotificationsService, SupervisorScopeService],
  exports: [AuditLogService, NotificationsService, SupervisorScopeService],
})
export class AuditModule {}

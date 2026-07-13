import { checklistsApi } from './api/checklists'
import { inventoryApi } from './api/inventory'
import { attendanceApi } from './api/attendance'
import { adminApi as adminDomainApi } from './api/admin'
import { settingsApi } from './api/settings'
import { superAdminApi } from './api/superAdmin'
import { productionApi } from './api/production'
import { purchasingApi } from './api/purchasing'

export * from './api/core'
export * from './api/checklists'
export * from './api/inventory'
export * from './api/attendance'
export * from './api/settings'
export * from './api/superAdmin'
export * from './api/production'
export * from './api/purchasing'

export {
    type Organization,
    type Venue,
    type TemplateDetail,
    type Question,
    type ComplianceReport,
    type AdminSubmission,
    type AdminSummary
} from './api/admin'

export const adminApi = {
    ...checklistsApi,
    ...inventoryApi,
    ...attendanceApi,
    ...adminDomainApi,
    ...settingsApi,
    ...productionApi,
    ...purchasingApi,
}

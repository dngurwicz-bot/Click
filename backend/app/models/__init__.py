from importlib import import_module
from pathlib import Path
from pkgutil import iter_modules

# Auto-import every model module in this package so new tables are registered
# in SQLAlchemy without requiring manual edits here.
_MODELS_DIR = Path(__file__).resolve().parent
for _module in iter_modules([str(_MODELS_DIR)]):
    if _module.name.startswith("_"):
        continue
    import_module(f"{__name__}.{_module.name}")

from app.models.admin_user import AdminUser
from app.models.admin_user_permission import AdminUserPermission
from app.models.tenant import (
    Tenant,
    TenantIdentity,
    TenantContact,
    TenantAddress,
    TenantSubscription,
    TenantSubscriptionModule,
    TenantStatus,
    TenantOrgStructureConfig,
)
from app.models.module import Module, ModulePrice, OrgTemplate, OrgTemplateDefault, OrgTemplateModule
from app.models.lookup import LookupItem, LookupList
from app.models.core import (
    Employee,
    EmployeeIdentity,
    EmployeeEmployment,
    EmployeeCompensation,
    EmployeeDocumentIndex,
    EmployeeChild,
    EmployeeBankAccount,
    EmployeeAward,
    EmployeeCertification,
    EmployeeCourse,
    EmployeeSkill,
    EmployeeWorkBreak,
    EmploymentEvent,
    OrgUnit,
    Position,
)
from app.models.billing import Invoice, BillingCharge, InvoiceLine, BillingSettings, Quote, QuoteLine, TenantPaymentRecord
from app.models.billing_engine import (
    BillingBillRun,
    BillingChangeEvent,
    BillingContract,
    BillingContractItem,
    BillingDocument,
    BillingDocumentLine,
    BillingLedgerEntry,
)
from app.models.audit_log import AuditLog
from app.models.seat_change_log import SeatChangeLog
from app.models.saved_report_view import SavedReportView

__all__ = [
    "AdminUser",
    "AdminUserPermission",
    "Tenant", "TenantIdentity", "TenantContact", "TenantAddress", "TenantSubscription", "TenantSubscriptionModule", "TenantStatus", "TenantOrgStructureConfig",
    "Module", "ModulePrice", "OrgTemplate", "OrgTemplateDefault", "OrgTemplateModule",
    "LookupList", "LookupItem",
    "Employee", "EmployeeIdentity", "EmployeeEmployment", "EmployeeCompensation", "EmployeeDocumentIndex",
    "EmployeeChild", "EmployeeBankAccount", "EmployeeAward", "EmployeeCertification", "EmployeeCourse",
    "EmployeeSkill", "EmployeeWorkBreak", "EmploymentEvent", "OrgUnit", "Position",
    "Invoice", "BillingCharge", "InvoiceLine", "BillingSettings", "Quote", "QuoteLine", "TenantPaymentRecord",
    "BillingContract", "BillingContractItem", "BillingChangeEvent", "BillingBillRun",
    "BillingLedgerEntry", "BillingDocument", "BillingDocumentLine",
    "AuditLog",
    "SeatChangeLog",
    "SavedReportView",
]

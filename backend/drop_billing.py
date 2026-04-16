import asyncio
from sqlalchemy import text
from app.database import engine

async def drop_billing():
    async with engine.begin() as conn:
        tables = [
            'invoice_lines', 'billing_charges', 'quote_lines', 'quotes', 'invoices',
            'billing_document_lines', 'billing_ledger_entries', 'billing_documents',
            'billing_bill_runs', 'billing_change_events', 'billing_contract_items',
            'billing_contracts', 'billing_settings'
        ]
        await conn.execute(text(f"DROP TABLE IF EXISTS {', '.join(tables)} CASCADE;"))
        print('Tables dropped successfully')

asyncio.run(drop_billing())

#!/usr/bin/env node
/**
 * Deploy organizational structure schema to Supabase
 * This script executes SQL migrations directly via Supabase REST API
 */

const fs = require('fs');
const path = require('path');

// Read Supabase credentials from FRONTEND .env.local
const envPath = path.join(__dirname, '../../FRONTEND/.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

const SUPABASE_URL = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1]?.trim();
const SUPABASE_ANON_KEY = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim();

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('❌ Error: Could not find Supabase credentials in .env.local');
    process.exit(1);
}

console.log('🚀 Starting Supabase Schema Deployment');
console.log(`Target: ${SUPABASE_URL}\n`);

// Read SQL files
const sql1 = fs.readFileSync(path.join(__dirname, '01_organizational_structure.sql'), 'utf8');
const sql2 = fs.readFileSync(path.join(__dirname, '02_organizational_structure_rls.sql'), 'utf8');

// Execute SQL via Supabase REST API
async function executeSql(sql, description) {
    console.log(`${'='.repeat(60)}`);
    console.log(`Executing: ${description}`);
    console.log(`${'='.repeat(60)}`);

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({ query: sql })
        });

        if (!response.ok) {
            const error = await response.text();
            console.error(`❌ Error: ${error}`);
            return false;
        }

        console.log(`✅ Success: ${description}\n`);
        return true;
    } catch (error) {
        console.error(`❌ Error: ${error.message}\n`);
        return false;
    }
}

// Main deployment function
async function main() {
    const migrations = [
        { sql: sql1, description: 'Organizational Structure Tables' },
        { sql: sql2, description: 'RLS Policies' }
    ];

    let successCount = 0;

    for (const { sql, description } of migrations) {
        const success = await executeSql(sql, description);
        if (success) successCount++;
    }

    console.log(`${'='.repeat(60)}`);
    console.log(`Deployment Summary: ${successCount}/${migrations.length} successful`);
    console.log(`${'='.repeat(60)}`);

    if (successCount === migrations.length) {
        console.log('✅ All migrations deployed successfully!');
    } else {
        console.log('⚠️  Some migrations failed.');
        process.exit(1);
    }
}

main().catch(console.error);

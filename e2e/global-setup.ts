import { FullConfig } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function globalSetup(config: FullConfig) {
    const supabaseUrl = 'http://127.0.0.1:54321';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY not found in .env.local');
    }

    // Seed data
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    if (error) throw error;

    const testUser = users.find(u => u.email === 'test@test.com');

    if (!testUser) {
        console.log('Seeding test user...');
        const { error: createError } = await supabase.auth.admin.createUser({
            email: 'test@test.com',
            password: 'password123',
            email_confirm: true,
            user_metadata: { display_name: 'Test User' }
        });
        if (createError) throw createError;
    }
}

export default globalSetup;

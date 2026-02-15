import { execSync } from 'child_process';

export default function globalSetup() {
    try {
        // Check if Supabase is already running
        execSync('npx supabase status', { stdio: 'pipe' });
    } catch {
        // Start Supabase if not running
        console.log('Starting Supabase...');
        execSync('npx supabase start', { stdio: 'inherit', timeout: 120000 });
    }
}

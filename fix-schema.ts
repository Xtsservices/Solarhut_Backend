import dotenv from 'dotenv';
import { validateAndFixAllTables } from './src/utils/schemaFix';

dotenv.config();

/**
 * Database Schema Fix Script
 * Run this script to fix the permissions table schema issue
 * 
 * Usage: npm run fix-schema
 * Or: npx ts-node fix-schema.ts
 */
const fixDatabaseSchema = async () => {
    try {
        console.log('🚀 Starting database schema fix...');
        console.log('⚠️  WARNING: This will drop and recreate the permissions table if needed');
        console.log('📝 Make sure you have backed up any important permission data\n');
        
        await validateAndFixAllTables();
        
        console.log('\n✅ Database schema fix completed successfully!');
        console.log('🎉 You can now try creating permissions again');
        
    } catch (error) {
        console.error('\n❌ Error during database schema fix:', error);
        process.exit(1);
    } finally {
        process.exit(0);
    }
};

// Run the fix
fixDatabaseSchema();
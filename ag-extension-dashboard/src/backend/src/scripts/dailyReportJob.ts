import { AgriculturalReportService } from '../services/agriculturalReportService';
import { logger } from '../utils/logger';

async function runDailyReportJob() {
    try {
        logger.info('Starting scheduled daily report job...');
        await AgriculturalReportService.generateDailyReports();
        logger.info('Scheduled daily report job completed successfully.');
        process.exit(0);
    } catch (error) {
        logger.error('Scheduled daily report job failed:', error);
        process.exit(1);
    }
}

// Execute the job if called directly
if (require.main === module) {
    runDailyReportJob();
}

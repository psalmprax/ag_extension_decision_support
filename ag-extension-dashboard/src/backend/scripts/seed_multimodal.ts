import { VectorService } from '../src/services/vectorService';
import { logger } from '../src/utils/logger';
import { v4 as uuidv4 } from 'uuid';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const multimodalArticles = [
    {
        id: uuidv4(),
        title: 'Fall Armyworm Lifecycle and Identification',
        content: `The fall armyworm (Spodoptera frugiperda) is a highly destructive pest. 
        Identification: Adult moths are greyish-brown with a wingspan of 32-40mm. 
        Lifecycle: Egg -> Larva (6 instars) -> Pupa -> Adult. 
        The larvae have a characteristic inverted 'Y' mark on their head. 
        Watch the identification guide video to see the 'Y' mark clearly on a live specimen.`,
        category: 'pest_control',
        crop: 'maize',
        sourceUrl: 'https://www.youtube.com/watch?v=identification_video_stub',
        contentType: 'video/mp4'
    },
    {
        id: uuidv4(),
        title: 'Proper Maize Spacing Chart',
        content: `Optimal maize spacing is critical for maximum yield. 
        Recommended spacing: 75cm between rows and 25cm between plants. 
        This ensures adequate sunlight and nutrient distribution. 
        Refer to the spacing diagram image for a visual layout of the field.`,
        category: 'crop_management',
        crop: 'maize',
        sourceUrl: 'https://images.unsplash.com/photo-1594488311340-025537618991?auto=format&fit=crop&q=80&w=1000',
        contentType: 'image/jpeg'
    },
    {
        id: uuidv4(),
        title: 'Soil pH and Nutrient Availability',
        content: `Soil pH significantly affects the availability of essential nutrients to plants. 
        Maize prefers a pH range of 5.8 to 7.0. 
        If pH is too low (acidic), phosphorus and magnesium become less available. 
        The chart shows the correlation between pH levels and yield percentage.`,
        category: 'soil_health',
        crop: 'maize',
        sourceUrl: 'https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&q=80&w=1000',
        contentType: 'image/png'
    }
];

import { initializeDatabase } from '../src/services/databaseService';
import { AIProviderFactory } from '../src/services/aiProvider/aiProvider';

async function seed() {
    logger.info('Initializing services for seeding...');
    await initializeDatabase();
    AIProviderFactory.initialize();
    
    logger.info('Starting multimodal seeding...');
    try {
        for (const article of multimodalArticles) {
            await VectorService.upsertDocument(
                article.id,
                article.content,
                {
                    title: article.title,
                    category: article.category,
                    crops: [article.crop],
                    sourceUrl: article.sourceUrl,
                    contentType: article.contentType
                }
            );
            logger.info(`Seeded multimodal article: ${article.title}`);
        }
        logger.info('Multimodal seeding completed successfully.');
    } catch (error) {
        logger.error('Seeding failed:', error);
        process.exit(1);
    }
}

seed().then(() => process.exit(0));

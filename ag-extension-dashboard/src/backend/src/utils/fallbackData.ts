/**
 * Synced Golden Dataset (Backend Fallback)
 * This ensures that if the database is empty or unavailable, we return 
 * logically consistent, geographically-synced data to the frontend.
 * 
 * Region: North Rift, Kenya
 * Crop Profile: Cereal-focused (Maize, Wheat, Sunflower)
 */

export const GOLDEN_OFFICER = {
    id: "officer-gold-001",
    firstName: "Jane",
    lastName: "Wanjiku",
    role: "extension_officer",
    region: "North Rift",
    email: "jane.wanjiku@gov.ke",
    phone: "+254 712 345 678",
    avatar: "https://i.pravatar.cc/150?u=jane"
};

export const GOLDEN_FARMERS = [
    {
        id: "farmer-gold-101",
        firstName: "John",
        lastName: "Kibet",
        phone: "+254 711 000 111",
        region: "North Rift",
        village: "Kitale East",
        crops: ["Maize", "Wheat"],
        farmSize: 4.5,
        isActive: true,
        assignedOfficerId: GOLDEN_OFFICER.id,
        latitude: 1.0191,
        longitude: 35.0023,
        vitalScore: 82,
        yieldHistory: [75, 78, 82, 85, 82]
    },
    {
        id: "farmer-gold-102",
        firstName: "Mary",
        lastName: "Atieno",
        phone: "+254 711 000 222",
        region: "North Rift",
        village: "Endebess",
        crops: ["Sunflower", "Maize"],
        farmSize: 2.8,
        isActive: true,
        assignedOfficerId: GOLDEN_OFFICER.id,
        latitude: 1.0667,
        longitude: 34.8500,
        vitalScore: 91,
        yieldHistory: [88, 89, 91, 90, 91]
    }
];

export const GOLDEN_VISITS = [
    {
        id: "visit-gold-501",
        farmerId: "farmer-gold-101",
        officerId: GOLDEN_OFFICER.id,
        visitType: "Pest Management",
        status: "completed",
        notes: "Maize stalk borer detected in 5% of crop. Recommended immediate application of Cypermethrin.",
        scheduledAt: new Date(Date.now() - 86400000 * 7).toISOString(),
        completedAt: new Date(Date.now() - 86400000 * 7).toISOString(),
        startedAt: new Date(Date.now() - 86400000 * 7).toISOString(),
        followUpRequired: true
    },
    {
        id: "visit-gold-502",
        farmerId: "farmer-gold-102",
        officerId: GOLDEN_OFFICER.id,
        visitType: "Soil Health",
        status: "scheduled",
        notes: "Routine soil PH testing for Mary's sunflower field. Farmer reports yellowing leaves.",
        scheduledAt: new Date(Date.now() + 86400000 * 2).toISOString(),
    }
];

export const GOLDEN_CHATS = [
    {
        id: "chat-gold-901",
        farmerId: "farmer-gold-101",
        officerId: GOLDEN_OFFICER.id,
        status: "active",
        category: "Pest Control",
        startedAt: new Date(Date.now() - 3600000).toISOString(),
        lastMessageAt: new Date(Date.now() - 300000).toISOString(),
        satisfactionScore: 4.8,
        language: "sw"
    }
];

export const GOLDEN_DASHBOARD_DATA = {
    overview: {
        totalFarmers: 145,
        totalOfficers: 12,
        activeConversations: 28,
        visitsThisMonth: 112,
        avgSatisfaction: 4.6,
        queriesResolved: 94,
        avgConversationsPerFarmer: 2.4
    },
    trends: {
        farmersGrowth: 12.5,
        conversationsGrowth: 8.2,
        visitsGrowth: 15.1,
        satisfactionChange: 0.2
    },
    geography: [
        { region: "North Rift", farmers: 85, officers: 6 },
        { region: "Central", farmers: 40, officers: 4 },
        { region: "Coast", farmers: 20, officers: 2 }
    ],
    crops: [
        { name: "Maize", percentage: 45 },
        { name: "Wheat", percentage: 30 },
        { name: "Sunflower", percentage: 15 },
        { name: "Beans", percentage: 10 }
    ],
    priorityQueue: [
        { farmerId: "farmer-gold-101", name: "John Kibet", reason: "Potential Pest Outbreak", severity: "high", crop: "Maize" },
        { farmerId: "farmer-gold-102", name: "Mary Atieno", reason: "Soil pH Anomaly", severity: "medium", crop: "Sunflower" }
    ],
    recentActivity: [
        { type: "visit", description: "Jane completed a Soil Health visit for Endebess sector.", time_diff: "2 mins ago" },
        { type: "query", description: "New insect identification request from John Kibet.", time_diff: "15 mins ago" }
    ]
};

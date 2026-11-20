
// Data moved verbatim from pages/LandingPage.tsx (pure move).

export const steps = [
  {
    num: '01',
    title: 'Photograph the leaf',
    desc: 'Point your camera at any yellowing leaf, spotted fruit, stem rot, or insect pest on your farm.',
  },
  {
    num: '02',
    title: 'Review possible causes',
    desc: 'The assessment suggests possible causes; it is not a confirmed diagnosis.',
  },
  {
    num: '03',
    title: 'Confirm with an expert',
    desc: 'Confirm the cause and locally authorized options with an extension officer before treatment.',
  },
];

export const globalTelemetryNodes = [
  { x: 51, y: 48, label: 'Nairobi, Kenya', region: 'East Africa' },
  { x: 44, y: 45, label: 'Lagos, Nigeria', region: 'West Africa' },
  { x: 48, y: 43, label: 'Kampala, Uganda', region: 'East Africa' },
  { x: 38, y: 44, label: 'Accra, Ghana', region: 'West Africa' },
  { x: 67, y: 36, label: 'New Delhi, India', region: 'South Asia' },
  { x: 76, y: 42, label: 'Hanoi, Vietnam', region: 'Southeast Asia' },
  { x: 29, y: 64, label: 'São Paulo, Brazil', region: 'Latin America' },
  { x: 23, y: 26, label: 'Saskatoon, Canada', region: 'North America' },
  { x: 53, y: 32, label: 'Cairo, Egypt', region: 'North Africa' },
  { x: 54, y: 55, label: 'Lusaka, Zambia', region: 'Southern Africa' },
];

export const faqItems = [
  {
    question: 'Does this app work without an active internet connection in rural fields?',
    answer:
      'Some field workflows support offline use and synchronization when connectivity returns. Cloud analysis and current external data require a connection; availability depends on the device and deployment.',
  },
  {
    question: 'Do I need an expensive smartphone to use GPExts?',
    answer:
      'The web application supports mobile browsers. SMS and USSD availability depends on provider and carrier configuration; contact your organization for supported channels.',
  },
  {
    question: 'Is GPExts free for individual smallholder farmers?',
    answer:
      'Availability and pricing depend on your organization and deployment. Check the current plan details before signing up.',
  },
  {
    question: 'Which crops and plant diseases are currently supported?',
    answer:
      'The disease reference includes multiple crops and conditions, but coverage and accuracy vary. Results are suggestions, not confirmed diagnoses; consult a local expert.',
  },
  {
    question: 'Can I listen to advice in my local native language?',
    answer:
      'Language and speech support vary by feature, browser and configured provider. Check the available language and audio options in your deployment.',
  },
  {
    question: 'How do Agricultural Extension Officers and Ministries use GPExts?',
    answer:
      'Extension officers use GPExts on motorbikes and field visits to register farmers, track GPS parcels, log observation histories, and coordinate outbreak containment. Ministries and cooperatives access a specialized web portal to view district outbreak heatmaps and optimize supply chain delivery.',
  },
];

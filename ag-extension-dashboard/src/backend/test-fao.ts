import { FAOService } from './src/services/faoService';
console.log(FAOService);
FAOService.getDiseaseAlerts('test').then(console.log).catch(console.error);

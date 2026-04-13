import { diseaseAlertTool } from './src/tools/diseaseAlertTool';
diseaseAlertTool.execute({ region: 'Lilongwe' }).then(console.log).catch(console.error);

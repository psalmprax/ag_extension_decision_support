/** STOP and START from a farmer: turn notices off or on, and confirm. */
import { query } from '@/services/databaseService';
import { START_WORDS, STOP_WORDS } from './noticeCopy';
import { sendFarmerNotice } from './farmerNotices';

export type OptCommand = 'stop' | 'start';

/** STOP or START when that is the whole message (so "stop the spray?" is still a question). */
export function optCommand(text: string): OptCommand | null {
    const word = text.trim().toUpperCase().replace(/[.!]+$/, '');
    if (STOP_WORDS.has(word)) return 'stop';
    if (START_WORDS.has(word)) return 'start';
    return null;
}

export async function applyOptCommand(farmerId: string, command: OptCommand): Promise<void> {
    const stop = command === 'stop';
    await query(
        'UPDATE farmers SET sms_opt_out = $2, sms_opt_out_at = CASE WHEN $2 THEN NOW() ELSE NULL END WHERE id = $1',
        [farmerId, stop],
    );
    await sendFarmerNotice(farmerId, stop ? 'stopped' : 'started', {}, { always: true });
}

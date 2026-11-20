/** The USSD menu for officers and managers: set the SMS PIN, or ask the AI (answer by SMS). */
import bcrypt from 'bcryptjs';
import { staffAiAnswer } from './officerSmsCommands';
import { con, end, numbered } from './ussdText';
import { smsCopy } from './smsCopy';
import { type SmsStaff, isValidPin, setSmsPin, tryPin } from './officerSmsAccess';
import { sendSmsReply } from './smsReply';

type Later = (label: string, work: () => Promise<unknown>) => void;

const WEAK_PIN = 'Use 4 digits that are not all the same or in order.';

/** New PIN, entered twice. */
function newPinSteps(staff: SmsStaff, steps: string[]): Promise<string> | string {
    const [pin, again] = steps;
    if (!pin) return con('Enter a new 4-digit SMS PIN:');
    if (!isValidPin(pin)) return end(WEAK_PIN);
    if (!again) return con('Enter the new PIN again:');
    if (again !== pin) return end('The two PINs did not match. Nothing was changed.');
    return setSmsPin(staff.id, pin).then(() => end('SMS PIN set. Text PIN and your 4 digits to unlock SMS commands.'));
}

async function pinMenu(staff: SmsStaff, steps: string[]): Promise<string> {
    if (!staff.sms_pin_hash) return newPinSteps(staff, steps);
    if (staff.sms_pin_locked) return end('SMS commands are locked after too many wrong PINs. Set a new PIN in the app.');
    const [current, ...rest] = steps;
    if (!current) return con('Enter your current SMS PIN:');
    // A wrong current PIN counts towards the lock, like a wrong PIN by SMS.
    if (!(await bcrypt.compare(current, staff.sms_pin_hash))) {
        const outcome = await tryPin(staff, current);
        return end(outcome === 'locked' ? 'Too many wrong PINs. Set a new PIN in the app.' : 'Wrong PIN.');
    }
    return newPinSteps(staff, rest);
}

export async function staffUssd(staff: SmsStaff, phone: string, steps: string[], later: Later): Promise<string> {
    const [choice, ...rest] = steps;
    if (!choice) return con(`${staff.first_name ?? ''}\n${numbered('staff', staff.language)}`.trim());
    if (choice === '1') return pinMenu(staff, rest);
    if (choice === '2') {
        const question = rest.join('*').trim();
        if (!question) return con(smsCopy('ussd_type_question', staff.language));
        later('staff ask', async () => {
            await sendSmsReply({ to: phone, text: await staffAiAnswer(staff, question), senderId: staff.id });
        });
        return end(smsCopy('ussd_answer_by_sms', staff.language));
    }
    return end(smsCopy('ussd_invalid', staff.language));
}

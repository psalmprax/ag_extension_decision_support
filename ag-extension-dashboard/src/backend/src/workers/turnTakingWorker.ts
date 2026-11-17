/**
 * Turn-taking job: once a minute, answers farmers whose officer has not
 * replied in time (or outside working hours), and sends safety steps for any
 * urgent message not yet answered. Leader-gated, so it runs once per
 * deployment however many replicas there are.
 */
import { logger } from '../utils/logger';
import { runIfLeader } from '../services/leaderElection';
import { decideAutoReply, isUrgentMessage } from '../services/chat/turnTaking';
import { answerFarmerInThread, listThreadsAwaitingReply, sendUrgentSafetyReply } from '../services/chat/threadAutoReply';

const TICK_MS = 60_000;
/** AI answers take seconds each; the rest wait for the next tick. */
const MAX_ANSWERS_PER_TICK = 10;

let timer: NodeJS.Timeout | null = null;
let initialRun: NodeJS.Timeout | null = null;

/** One pass; returns how many threads were answered. */
export async function runTurnTakingTick(now: Date = new Date()): Promise<number> {
    const threads = await listThreadsAwaitingReply();
    let answered = 0;
    for (const thread of threads) {
        if (answered >= MAX_ANSWERS_PER_TICK) break;
        try {
            if (thread.question && isUrgentMessage(thread.question.content)) {
                await sendUrgentSafetyReply(thread);
                answered++;
                continue;
            }
            const decision = decideAutoReply(thread.state, now, thread.settings);
            if (decision.action !== 'answer') continue;
            // Over the SMS limit nothing is sent; the officer still sees the message.
            if ((await answerFarmerInThread(thread, decision.reason)) === 'answered') answered++;
        } catch (error) {
            // One failing thread must not stop the others; it is retried next tick.
            logger.warn(`Turn-taking: could not answer thread ${thread.conversationId}:`, error);
        }
    }
    if (answered > 0) logger.info(`Turn-taking: answered ${answered} farmer thread(s)`);
    return answered;
}

function tickIfLeader(): void {
    void runIfLeader('turn-taking-worker', () => runTurnTakingTick()).catch(error =>
        logger.warn('Turn-taking tick failed:', error),
    );
}

export function startTurnTakingWorker(intervalMs: number = TICK_MS): void {
    if (timer) return;
    logger.info(`Starting turn-taking worker (${intervalMs / 1000}s interval, leader-gated)`);
    timer = setInterval(tickIfLeader, intervalMs);
    timer.unref?.();
}

export function stopTurnTakingWorker(): void {
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
    if (initialRun) {
        clearTimeout(initialRun);
        initialRun = null;
    }
}

// Auto-start after the database is ready, like the other interval workers.
if (process.env.NODE_ENV !== 'test') {
    initialRun = setTimeout(() => startTurnTakingWorker(), 15_000);
    initialRun.unref?.();
}

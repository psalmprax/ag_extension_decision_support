import { Router } from 'express';
import loginRouter from './login';
import registerRouter from './register';
import sessionRouter from './session';
import mfaRouter from './mfa';
import sessionsRouter from './sessions';
import passwordResetRouter from './passwordReset';

const router = Router();

router.use(loginRouter);
router.use(registerRouter);
router.use(sessionRouter);
router.use(mfaRouter);
router.use(sessionsRouter);
router.use(passwordResetRouter);

export default router;

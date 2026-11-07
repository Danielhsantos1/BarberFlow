import { Router, type IRouter } from "express";
import healthRouter from "./health";
import { requireAuthenticatedUser, requireSalonMembership } from "../middlewares/auth";
import catalogRouter from "./catalog";
import operationsRouter from "./operations";
import publicBookingRouter from "./public-booking";
import salonRouter from "./salon";
import schedulingRouter from "./scheduling";

const router: IRouter = Router();

router.use(healthRouter);
router.use(publicBookingRouter);
router.use(salonRouter);
router.use(requireAuthenticatedUser, requireSalonMembership);
router.use(schedulingRouter);
router.use(catalogRouter);
router.use(operationsRouter);

export default router;

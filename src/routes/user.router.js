import { Router } from "express"
import { upload }  from "../middlewares/multer.middlewares.js"
import { verifyJwt } from "../middlewares/auth.middlewares.js";
import { 
    loginUser, 
    logoutUser, 
    registerUser, 
    refreshAccessToken, 
    changeCurrentPassword, 
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannetProfile,
    getWatchHistory } from "../controllers/user.controller.js";



const router = Router()


router.route("/register").post(
    upload.fields([
        {
            name: "avatar",
            maxCount: 1
        }, 
        {
            name: "coverImage",
            maxCount: 1
        }
    ]),
    registerUser
    )
router.route("/login").post(loginUser);

// SECURE ROUTES
router.route("/logout").post(verifyJwt, logoutUser);
router.route("/refresh-token").post(refreshAccessToken);
router.route("/change-password").post(verifyJwt, changeCurrentPassword);
router.route("/current-user").get(verifyJwt, getCurrentUser);
router.route("/update-account-details").patch(verifyJwt, updateAccountDetails);
router.route("/update-avatar").patch(verifyJwt, upload.single("avatar"), updateUserAvatar);
router.route("/update-coverImage").patch(verifyJwt, upload.single("coverImage"), updateUserCoverImage);
router.route("/c/:username").get(verifyJwt, getUserChannetProfile);
router.route("/watch-history").get(verifyJwt, getWatchHistory);





export default router;
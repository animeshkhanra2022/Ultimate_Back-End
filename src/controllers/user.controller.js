import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponce } from "../utils/ApiResponce.js"
import jwt from "jsonwebtoken"
import mongoose from "mongoose"



const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken  = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken };

    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating Acccess and Refresh token");
    }
}


const registerUser = asyncHandler( async (req, res) => {
    // take username, fullName, email, password from user
    // check all are given
    // email checker
    // check for exist in database
    // take avatar and coverImage from user
    // check for avatar - Is exist or not
    // upload them on cloudinary - check for avatar
    // create user object - create entry in db
    // remove password and refresh token from responce
    // check for user creation
    // return responce

    const { username, email, fullName, password } = req.body;

    if(
        [username, email, fullName, password].some((field) => field?.trim() === "")
    ){
        throw new ApiError(400, "All fields are required")
    }

    //^ Email checker
    if(email){
        if(!email.includes('@') || email.split('@').length !== 2){
            throw new ApiError(400, "Invalid email formate: must contain exactly one @ symbol");
        }

        const domain = email.split('@')[1].toLowerCase();
        const allowedDomains = ['gmail.com', 'outlook.com', 'yahoo.com'];
        if(!allowedDomains.includes(domain)){
            throw new ApiError(400, "Email must be from Gmail, Outlook, or Yahoo");
        }else{
            console.log("this email from ", domain);
            console.log(email.split('@'))
        }
    }

    const existedUser =  await User.findOne({
        $or: [{ username }, { email }]
    })
    // console.log(existedUser)

    if(existedUser){
        throw new ApiError(409, "username or email already exist");
    }

    console.log(req.files?.avatar[0]?.path);
    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }

    if(!avatarLocalPath){
        throw new ApiError(400, "Can not get local path of Avatar image");
    }
    // else{
    //     console.log("Avatar local file is: ", avatarLocalPath);
    // }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar){
        throw new ApiError(400, "Avatar file is required")
    }

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    if(!createdUser) {
        throw new ApiError(500, "Something went wrong while registerig the user");
    }

    return res.status(201).json(
        new ApiResponce(200, createdUser, "User registered successfully")
    )
    
})

const loginUser = asyncHandler( async (req, res) => {

    const { username, email, password } = req.body;

    if(!username && !email){
        throw new ApiError(400, "username or email must be required");
    }

    const user = await User.findOne({
        $or: [{username}, {email}]
    })
    

    // console.log(user)
    if(!user){
        throw new ApiError(404, "User not registered");
    }
    
    const isPasswordValid = await user.isPasswordCorrect(password);

    if(!isPasswordValid){
        throw new ApiError(401, "Invalid user credentials");
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);

    // const details = user.select("-password -refreshToken");

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");
    // console.log("after change: ",loggedInUser)

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponce(
            200,
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User Logged In successfully"
        )
    )




})

const logoutUser = asyncHandler( async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: { refreshToken: 1 }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponce(201, {}, "User Logged Out!"))
})

const refreshAccessToken = asyncHandler( async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if(!incomingRefreshToken){
        throw new ApiError(401, "Unauthorized request !");
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
        
        // console.log("THE INFO FROM DECODEDtOKEN: ",decodedToken)  //* SEE THIS THINGS
    
        const user = await User.findById(decodedToken?._id);
    
        if(!user){
            throw new ApiError(400, "Invalid Refresh Token");
        }
    
        if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(400, "Refresh token is expired or used");
        }
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
        const { accessToken, newRefreshToken } = await generateAccessAndRefreshToken(user._id);
    
        return res
        .status(201)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponce(
                200, 
                {accessToken, refreshToken: newRefreshToken},
                "Access token refresh successfully"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token");
    }

})

const changeCurrentPassword = asyncHandler( async(req, res) => {
    const { currentPassword, newPassword } = req.body;

    if(
        [currentPassword, newPassword].some((field) => field?.trim() === "")
    ){
        throw new ApiError(401, "All fields are required")
    }

    const user = await User.findById(req.user?._id);

    const isPasswordCorrect = await user.isPasswordCorrect(currentPassword);

    if(!isPasswordCorrect){
        throw new ApiError(400, "Invalid current password!");
    }

    user.password = newPassword;
    await user.save({validateBeforeSave: false})

    return res
    .status(200)
    .json(
        new ApiResponce(201, {}, "Change password successfully!")
    )

})

const getCurrentUser = asyncHandler( async(req, res) => {
    return res
    .status(200)
    .json(new ApiResponce(200, req.user, "Current User fetch successfully!"))
})

const updateAccountDetails = asyncHandler( async(req, res) => {
    const { fullName, email } = req.body;

    if(!fullName || !email){
        throw new ApiError(400, "All fields are required!");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName,
                email: email
            }
        },
        {
            new: true
        }
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponce(200, user, "Account details update successfully")
    )
})

// two middleware become here
const updateUserAvatar = asyncHandler( async (req, res) => {
    const avatarLocalPath = req.file?.path;
    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar's local path missing!");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    if(!avatar.url){
        throw new ApiError(400, "Error while uploading Avatar!");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        { new: true }
    ).select("-password")

    return res
    .status(201)
    .json(new ApiResponce(201, user, "Avatar update successfully"))
})

// two middleware become here
const updateUserCoverImage = asyncHandler( async(req, res) => {
    const coverImageLocalPath = req.file?.path;
    if(!coverImageLocalPath){
        throw new ApiError(400, "Cover image file is missing!");
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath);
    if(!coverImage){
        throw new ApiError(400, "Error while uploading on cover image")
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                coverImage: coverImage.url
            }
        },
        { new: true }
    ).select("-password")

    return res
    .status(201)
    .json(new ApiResponce(201, user, "Cover image update successfully"))
})

const getUserChannetProfile = asyncHandler( async(req, res) => {
    const {username} = req.params;
    if(!username?.trim()) {
        throw new ApiError(400, "Username is missing");
    }

    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscriberCount: {
                    $size: "$subscribers"
                },
                channelsSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                username: 1,
                fullName: 1,
                email: 1,
                subscriberCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1
            }
        }
    ])

    if(!channel?.user){
        throw new ApiError(400, "Channel does not exists"); 
    }


    return res
    .status(201)
    .json(new ApiResponce(201, channel[0], "User channel fetched successfully"))
    
})


const getWatchHistory = asyncHandler( async(req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res
    .status(200)
    .json(
        new ApiResponce(200, user[0].watchHistory, "Watch history fetched successfully")
    )
})



export { registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannetProfile,
    getWatchHistory
}
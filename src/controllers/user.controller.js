import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponce } from "../utils/ApiResponce.js"




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
        throw new ApiError(200, "All fields are required")
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



export { registerUser }
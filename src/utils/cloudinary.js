import {v2 as cloudinary } from "cloudinary"
import fs from "fs";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
})

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if(!localFilePath) return null;
        console.log("Local file is not found");

        // upload on clodinary
        const responce = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto"
        })
        console.log("file is uploaded on cloudinary", responce.url);
        return responce;

        // fs.unlink()
    } catch (error) {
        fs.unlinkSync(localFilePath) // remove the locally saved temporary file
        return null;
    }
}


export { uploadOnCloudinary };
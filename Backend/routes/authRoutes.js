const express=require('express');
const User=require('../models/userModel')
const Verification=require('../models/verificationModel')
const responseFunction=require('../utils/responseFunction')
const nodemailer=require('nodemailer')
const dotenv=require('dotenv')
dotenv.config();
const router=express.Router();
const bcrypt=require('bcrypt')   // to decode the password
const jwt=require('jsonwebtoken')
const authTokenHandler=require('../middleware/checkAuthToken')


const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 1 day
};
const mailer = async (receiverMail, code) => {
    try {
        // 1. Fix transporter configuration
        let transporter = nodemailer.createTransport({
            service: 'gmail',  // Use 'service' instead of manual host/port
            auth: {
                user: process.env.COMPANY_EMAIL,
                pass: process.env.GMAIL_APP_PASSWORD
            }
            // Remove other options as they're automatically set by 'service: gmail'
        });

        // 2. Send mail with better error handling
        let info = await transporter.sendMail({
            from: `"Team MastersGang" <${process.env.COMPANY_EMAIL}>`,  // Proper formatted sender
            to: receiverMail,
            subject: "OTP for MastersGang",
            text: `Your OTP is ${code}`,
            html: `<p>Your OTP is <strong>${code}</strong></p>`
        });

        console.log("Message sent: %s", info.messageId);
        return !!info.messageId;  // Convert to boolean

    } catch (error) {
        console.error('Mailer error:', error);
        return false;
    }
};

router.get('/',(req,res)=>{
    res.json({
        message:"Auth route home"
    })
})

// To send OTPs
router.post('/sendotp', async (req, res) => {
    const { email } = req.body;
    
    if (!email) {
        return responseFunction(res, 400, "Email is required", null, false);
    }

    try {
        // Delete any existing OTP for this email
        await Verification.deleteMany({ email });
        
        // Generate 6-digit OTP
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Send OTP via email
        const isSent = await mailer(email, code);
        
        if (!isSent) {
            return responseFunction(res, 500, "Failed to send OTP", null, false);
        }
        
        // Store plain text OTP in database
        await Verification.create({ email, code });
        
        return responseFunction(res, 200, "OTP sent successfully", null, true);
        
    } catch (err) {
        console.error("OTP sending error:", err);
        return responseFunction(res, 500, "Internal Server error", null, false);
    }
});

router.post('/register', async (req, res) => {
    console.log('Received registration request:', req.body);
    const { name, email, password, otp, role } = req.body;
    
    // Input validation
    if (!name || !email || !password || !otp || !role) {
        return responseFunction(res, 400, "All fields are required", null, false);
    }
    
    if (password.length < 6) {
        return responseFunction(res, 400, "Password should be at least 6 characters", null, false);
    }

    try {
        // Check if user already exists
        const userExists = await User.findOne({ email });
        if (userExists) {
            return responseFunction(res, 400, "User already exists", null, false);
        }
        
        // Verify OTP (now plain text comparison)
        const verification = await Verification.findOne({ email });
        if (!verification) {
            return responseFunction(res, 400, "Please request an OTP first", null, false);
        }
        
        if (otp !== verification.code) {
            return responseFunction(res, 400, "Invalid OTP", null, false);
        }
        
        // Create new user (password will be hashed by User model pre-save hook)
        const user = new User({ name, email, password, role });
        await user.save();
        
        // Delete used OTP
        await Verification.deleteOne({ email });
        
        // Generate tokens
        const authToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET_KEY, { expiresIn: '1d' });
        const refreshToken = jwt.sign({ userId: user._id }, process.env.JWT_REFRESH_SECRET_KEY, { expiresIn: '10d' });
        
        // Set cookies
        res.cookie('authToken', authToken, cookieOptions);
        res.cookie('refreshToken', refreshToken, cookieOptions);
        
        // Remove password from response
        user.password = undefined;
        
        return responseFunction(res, 200, "Registered successfully", { user, authToken, refreshToken }, true);
        
    } catch (err) {
        console.error("Registration error:", err);
        return responseFunction(res, 500, "Internal server error", null, false);
    }
});

router.post('/login',async (req,res,next)=>{
    try{
    const {email,password}=req.body;
    const user=await User.findOne({email});
    if(!user){
        return responseFunction(res,400,"Invalid credentials",null,false);
    }
    const isMatch=await bcrypt.compare(password,user.password);
    if(!isMatch){
        return responseFunction(res,400,"Invalid credentials",null,false);
    }
    const authToken=jwt.sign({userId:user._id},process.env.JWT_SECRET_KEY,{expiresIn:'1d'});
    const refreshToken=jwt.sign({userId:user._id},process.env.JWT_REFRESH_SECRET_KEY,{expiresIn:'10d'});
    
    user.password=undefined;
    
    res.cookie('authToken',authToken,{httpOnly:true,secure:true,sameSite:'none'});
    res.cookie('refreshToken',refreshToken,{httpOnly:true,secure:true,sameSite:'none'});

    return responseFunction(res,200,"Logged in successfully",{user,authToken,refreshToken},true);

    }
    catch(err){
        return responseFunction(res,500,"Internal server error",err,false);
    }
})
// extract the user and verify the tokens
router.get('/checklogin',authTokenHandler,async(req,res,next)=>{
    console.log(`checking login ${req.message}`)
    res.json({
        ok:req.ok,
        message:req.message,
        userId:req.userId
    })
})
 router.get('/getuser',authTokenHandler,async(req,res,next)=>{
    try{
    // Checking the user
      const user=await User.findById(req.userId).select('-password');
      if(!user){
        return responseFunction(res,400,'User not found',null,false);
      }
      return responseFunction(res,200,'User found',user,true);
    }
    catch(err){
        return responseFunction(res,500,"Internal Server error",err,false);
    }
 })

router.get('/logout',authTokenHandler,async(req,res,next)=>{
    res.clearCookie('authToken');
    res.clearCookie('refreshToken');
    res.json({
        ok:true,
        message:'Logged out Successfully'
    })
})


module.exports=router;

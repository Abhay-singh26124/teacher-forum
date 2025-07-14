const express=require('express');
const router=express.Router();
const authTokenHandler=require('../middleware/checkAuthToken')
const Classroom=require('../models/classroomModel')
const responseFunction=require('../utils/responseFunction')
const Post=require('../models/postModel');
const ClassroomJoin=require('../models/classroomJoinModel')
const User=require('../models/userModel');
const { configDotenv } = require('dotenv');
const nodemailer = require('nodemailer');


const mailer = async (receiverMail, subject, text, html) => {
  try {
      let transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
              user: process.env.COMPANY_EMAIL,
              pass: process.env.GMAIL_APP_PASSWORD
          },
          logger: true,
          debug: true
      });

      let info = await transporter.sendMail({
          from: `"Team MastersGang" <${process.env.COMPANY_EMAIL}>`,
          to: receiverMail,
          subject: subject,
          text: text,
          html: html || `<p>${text}</p>`
      });

      console.log("Message sent: %s", info.messageId);
      console.log("Accepted recipients:", info.accepted);
      console.log("Rejected recipients:", info.rejected);
      
      return info.accepted.length > 0;

  } catch (error) {
      console.error('Mailer error:', error);
      throw error;
  }
};
router.post('/create',authTokenHandler,async(req,res)=>{
  const {name,description}=req.body;
  if(!name){
    return responseFunction(res,400,'Classroom name is required',null,false);
  }
  try{
  const newClassroom=new Classroom({
    name,
    description,
    owner:req.userId
  })
  await newClassroom.save();
  return responseFunction(res,201,'Classroom created successfully',newClassroom,true);
  }
  catch(err){
    return responseFunction(res,500,'Internal Server error',err,false);
  }
})

router.get('/classroomscreatedbyme',authTokenHandler,async(req,res)=>{
    try{
        const classrooms=await Classroom.find({owner:req.userId});
        return responseFunction(res,200,'Classrooms fetched successfully',classrooms,true);
    }
    catch(err){
        return responseFunction(res,500,'Internal Server error',err,false);
    }
})

router.get('/getclassbyid/:classid',authTokenHandler,async(req,res)=>{
  const {classid}=req.params;
  try{
    const classroom=await Classroom.findById(classid).populate('posts');
    if(!classroom){
      return responseFunction(res,404,'Classroom not found',null,false)
    }
    return responseFunction(res,200,'Classroom fetched successfully',classroom,true)
  }
  catch(err){
    return responseFunction(res,500,'Internal server error',err,false)
  }
})

router.post('/addpost',authTokenHandler,async(req,res)=>{
  const {title,description,classId}=req.body;
  try{
    const classroom=await Classroom.findById(classId);
    if(!classroom){
      return res.status(404).json({message:'Classroom not found'});
    }
    const newPost=new Post({
      title,
      description,
      classId,
      createdBy:req.userId
    });
    await newPost.save();

    
    classroom.posts.push(newPost._id);
    await classroom.save();
    res.status(201).json({message:'Post created successfully',post:newPost})
  }
  catch(error){
    res.status(500).json({message:'Server error',error})
  }
})

router.get('/classrooms/search',async (req,res)=>{
  try{
    const term=req.query.term
    if(!term){
      return responseFunction(res,400,'Search term is required',null,false)
    }
    const results=await Classroom.find({
      name:{$regex : new RegExp(term,'i')}
    })
    if(results.length===0){
      return responseFunction(res,404,'Classroom not found',null,false);
    }
    responseFunction(res,200,'Search results',results,true)
  }
  catch(error){
    console.log(error)
    responseFunction(res,500,'Internal Server error',error,false)
  }
})

router.post('/request-to-join', async (req, res) => {
  try {
      const { classroomId, studentEmail } = req.body;
      
      
      if (!classroomId || !studentEmail) {
          return responseFunction(res, 400, 'Classroom ID and student email are required', null, false);
      }

      
      const classroom = await Classroom.findById(classroomId)
          .populate('owner', 'email');

      if (!classroom) {
          return responseFunction(res, 404, 'Classroom not found', null, false);
      }

      if (!classroom.owner?.email) {
          return responseFunction(res, 400, 'Classroom owner email not found', null, false);
      }

      
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const ownerEmail = classroom.owner.email;

      console.log(`Attempting to send OTP to: ${ownerEmail}`);

      
      try {
          const emailSent = await mailer(
              ownerEmail,
              'Classroom Join Request OTP',
              `A student has requested to join your classroom. OTP : ${otp}`,
              `<p>A student has requested to join your classroom.</p>
               <p><strong>OTP: ${otp}</strong></p>`
          );

          if (!emailSent) {
              throw new Error('Email failed to send');
          }
      } catch (emailError) {
          console.error('Email sending failed:', emailError);
          return responseFunction(res, 500, 'Failed to send OTP email', null, false);
      }

      
      const joinRequest = new ClassroomJoin({
          classroomId: classroom._id,
          classroomOwner: classroom.owner._id,
          studentEmail,
          otp
      });

      await joinRequest.save();

      return responseFunction(res, 200, 'OTP sent to teacher', { 
          requestId: joinRequest._id,
          ownerEmail: ownerEmail
      }, true);

  } catch (error) {
      console.error('Error in join request:', error);
      return responseFunction(res, 500, error.message, null, false);
  }
});

router.post('/verify-otp', authTokenHandler, async (req, res) => {
  try {
    const { classroomId, studentEmail, otp } = req.body;

    
    if (!classroomId || !studentEmail || !otp) {
      return responseFunction(res, 400, 'All fields are required', null, false);
    }

    
    const joinRequest = await ClassroomJoin.findOne({
      classroomId,
      studentEmail,
      otp
    });

    if (!joinRequest) {
      return responseFunction(res, 400, 'Invalid OTP or request', null, false);
    }

    
    const classroom = await Classroom.findByIdAndUpdate(
      classroomId,
      { $addToSet: { students: studentEmail } },
      { new: true }
    );

    if (!classroom) {
      return responseFunction(res, 404, 'Classroom not found', null, false);
    }


    await ClassroomJoin.deleteOne({ _id: joinRequest._id });

    return responseFunction(res, 200, 'Successfully joined class', null, true);

  } catch (err) {
    console.error('OTP verification error:', err);
    return responseFunction(res, 500, 'Server error', null, false);
  }
});

router.get('/classroomforstudent',authTokenHandler,async (req,res)=>{
  try{
    const user=await User.findById(req.userId)
    if(!user){
      return responseFunction(res,404,'User not found',null,false)
    }
    const studentEmail=user.email;
    const classrooms=await Classroom.find({students:studentEmail})
    if(classrooms.length===0){
    return responseFunction(res,404,'No clasroom found',null,false);
    }
    return responseFunction(res,200,'Classroom fetched successfully',classrooms,true)
  }
  catch(err){
    console.log(err)
    return responseFunction(res,500,'Internal server error',err,false)
  }
})
module.exports=router
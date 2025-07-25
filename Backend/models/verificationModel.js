// const mongoose=require('mongoose');
// const bcrypt=require('bcrypt');
// // This is the OTP part
// const verificationSchema=new mongoose.Schema({
//     email:{required :true,type: String},
//     code:{
//         required:true, type:String
//     }
// },{timestamps:true})

// verificationSchema.pre('save',async function(next){
//     const verification=this;
//     if(verification.isModified('code')){
//         verification.code=await bcrypt.hash(verification.code,10)
//     }
//     next();
// })
// module.exports=mongoose.model('Verification',verificationSchema)

const mongoose = require('mongoose');

const verificationSchema = new mongoose.Schema({
    email: { 
        type: String, 
        required: true,
        unique: true // Ensure one OTP per email
    },
    code: { 
        type: String, 
        required: true 
    }, // Now storing plain text OTP
    createdAt: { 
        type: Date, 
        default: Date.now,
        expires: '5m' // Auto-delete after 5 minutes
    }
});

module.exports = mongoose.model('Verification', verificationSchema);
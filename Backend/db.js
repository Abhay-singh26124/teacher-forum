const mongoose=require('mongoose')


const MONGO_URL=process.env.MONGO_URL
const DB_NAME=process.env.DB_NAME

mongoose.connect(MONGO_URL,{
    dbName:DB_NAME
}).then(()=>{
    console.log('Connected to the db')
})
.catch((err)=>{
    console.log('Error connecting',err)
})
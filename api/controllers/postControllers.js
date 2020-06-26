const jwt = require("jsonwebtoken");
const { hash, compare } = require("bcryptjs")
const Joi = require("@hapi/joi");

const UserDetails = require("../models/user")
const AdminDetails = require("../models/Admin")
const Product = require("../models/product")

const { sendMailToUser, forgotPasswordMailing } = require("../utils/nodeMailer")


module.exports={
      async postProduct(req, res){

        try{
        const product = await new Product({ ...req.body })
        console.log("product1",product)
        product.save();
        console.log("product posted successfully");
        res.status(202).send({message:"product Posted successfully"});
      }
       catch (error) {
        return res.status(500).send(error.message)
      }
       
      },

     // --------------------------User Registration------------------------

     async userRegister(req, res) {
        try {

            const { name, email, password } = req.body
            const Schemavalidation = Joi.object({
                name: Joi.string().min(3).max(30).required(),
                email: Joi.string().email({ minDomainSegments: 2, tlds: { allow: ['com', 'net'] } }),
                password: Joi.string().min(6).required() 
              })
              const { error, result } = Schemavalidation.validate({ name: name, email: email, password: password })
              if (error) return res.status(422).send({ Error: error.message })

              if(req.body.role == 'Admin') var schema = AdminDetails
              if(!req.body.role ) var schema = UserDetails

              const emailCheck = await schema.findOne({ email: req.body.email })
              console.log(emailCheck)
              if (emailCheck) return res.send( {error:"Duplicate Email"});

              const activationToken = await jwt.sign({ id: Math.random() }, process.env.TEMP_TOKEN_SECRET, { expiresIn: 1000 * 1000 * 60 })
              const user = await new schema ({ ...req.body });
              console.log(user)
              
              const hashedPassword = await hash(req.body.password, 10);
              user.password = hashedPassword;
              user.activationToken = activationToken;
              user.save()
              sendMailToUser( req.body.name,req.body.email, activationToken);
              res.status(202).send({message:` account registered Successfully. Please visit your Email and activate the account by verifying the link sent to your Email`});
        
        } catch (err) {
            if (err.name === "SequelizeValidationError")
              return res.status(400).send(`error: ${err.message}`);
       
         }
        },
         // -------------------------------User Login---------------------
  async userLogin(req, res) {
    try {
      var email = req.body.email;
      var password = req.body.password;
      if (!email || !password)
        return res.status(400).send({error:"Incorrect credentials"});

        if(req.body.role == "Admin") var schema = AdminDetails;
        if(!req.body.role) var schema = UserDetails;

      const user = await schema.findOne({ email });
      if (!user) return res.status(400).send({error:"Incorrect credentials(email not found)"});
      console.log("password",password)
      console.log("user.database.password",user.password)
      const isMatched = await compare(password, user.password);
      if (!isMatched) return res.send({error:"Incorrect credentials(Wrong Password)"});
      //if (!user.isVerified) return res.status(401).send({error:"You are not verified, please activate link sent to you through Email"});
      if (user.isBlocked) return res.status(401).send({error:`${user.name}, you are blocked for the misuse of SeasonalEmployment.com.....`});

      const token = await jwt.sign({ _id: user._id }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: 1000 * 600 * 100 })
      user.jwt = token;
      user.save()
      return res.status(202).send({ jwt:token ,user})
    }
    catch (error) {
      return res.status(500).send({error:error.message})
    }
  },

  async forgotPassword(req, res) {
    try {
      
      const user = await UserDetails.findOne({ email: req.body.email,  isVerified: false});
      if (!user) return res.send({error:"Incorrect Credentials or kindly activate your account by visiting the link that has been sent to you"})
      if (user.isBlocked) return res.status(401).send({error:`${user.name}, you are blocked for the misuse of BigBuy.com.....`});
      const rawPassword = (Math.floor(Math.random() * 100000000)).toString();
      const hashedPassword = await hash(rawPassword, 10)
      user.password = hashedPassword;
      user.save();
      forgotPasswordMailing(req.body.email, rawPassword)
      return res.status(202).send({message:"A System generated password has been sent to your email successfully. Login with that password and edit your password in profile section if needed"})
    } catch (err) {
      return res.status(500).send({error:err.message})
    }
  }
}



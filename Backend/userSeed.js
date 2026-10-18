import User from './models/User.js'
import bcrypt from 'bcryptjs'
import connectToDatabase from './db/db.js'

const userRegister = async () => {
    connectToDatabase()
    try {
        const hashPassword = await bcrypt.hash("Sudireddy@111", 10)
        const newUser = new User({
            name: "Admin",
            email: "admin@hakirush.com",
            password: hashPassword,
            role: "admin"
        })
        await newUser.save()
    } catch (error) {
        console.log(error);
    }
}

userRegister();
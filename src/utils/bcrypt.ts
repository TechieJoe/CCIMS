
import * as bcrypt from 'bcrypt';

export function encodedPwd(password: string){

    const SALT = bcrypt.genSaltSync();
    return bcrypt.hashSync(password, SALT)

}

export function comparePwd(password: string, hashPwd: string){
    return bcrypt.compareSync(password, hashPwd)
}

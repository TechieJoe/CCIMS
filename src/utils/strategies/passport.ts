import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-local";
import { userService } from "src/services/users.service";

@Injectable()
export class localStrategy extends PassportStrategy(Strategy){

    constructor(@Inject("USER_SERVICE") private userService: userService ){
        super({
            usernameField: 'email'
        })
    }

    async validate(email: string, password: string){
        console.log('passport')
        const user = await this.userService.validateUser(email, password);
        if(user){

            return user;
        }
        throw new UnauthorizedException()

    }
}

import { Test, TestingModule } from '@nestjs/testing';
import { userService } from './users.service';

describe('FarmAppService', () => {
  let service: userService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [userService],
    }).compile();

    service = module.get<userService>(userService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

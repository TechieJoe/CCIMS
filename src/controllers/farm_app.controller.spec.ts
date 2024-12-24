import { Test, TestingModule } from '@nestjs/testing';
import { FarmAppController } from './farm_app.controller';

describe('FarmAppController', () => {
  let controller: FarmAppController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FarmAppController],
    }).compile();

    controller = module.get<FarmAppController>(FarmAppController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

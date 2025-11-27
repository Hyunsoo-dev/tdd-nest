import { Test, TestingModule } from '@nestjs/testing';
import { PointService } from './point.service';
import { UserPointTable } from 'src/database/userpoint.table';
import { PointHistoryTable } from 'src/database/pointhistory.table';
import { TransactionType } from './point.model';

describe('PointService', () => {
  let pointService: PointService;
  let userDb: jest.Mocked<UserPointTable>;
  let historyDb: jest.Mocked<PointHistoryTable>;
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PointService,
        {
          provide: UserPointTable,
          useValue: { selectById: jest.fn(), insertOrUpdate: jest.fn() },
        },
        {
          provide: PointHistoryTable,
          useValue: { insert: jest.fn(), selectAllByUserId: jest.fn() },
        },
      ],
    }).compile();

    pointService = module.get<PointService>(PointService);
    userDb = module.get(UserPointTable) as jest.Mocked<UserPointTable>;
    historyDb = module.get(PointHistoryTable) as jest.Mocked<PointHistoryTable>;
  });

  it('should be defined', () => {
    expect(pointService).toBeDefined();
    expect(userDb).toBeDefined();
    expect(historyDb).toBeDefined();
  });

  describe('포인트 조회', () => {
    /**
     * 시나리오
     * 1. ID 가 정수 타입이 아니라면 에러가 발생한다.
     * 2. ID 가 0 이하라면 에러가 발생한다.
     * 3. 존재하지 않는 ID 라면 { id: id, point: 0, updateMillis: Date.now() } 가 반환된다.
     * 4. 정상적인 ID 라면 { id: id, point: 고객의 point, updateMillis: Date.now() } 가 반환된다.
     *
     */
    it('ID 가 number 타입이 아니라면 에러가 발생한다.', async () => {
      // Arrange
      const userId = 0.1;

      // Act
      jest
        .spyOn(userDb, 'selectById')
        .mockRejectedValueOnce(new Error('올바르지 않은 ID 값 입니다.'));

      const userPoint = () => pointService.getPoint(userId);

      // Assert
      await expect(userPoint()).rejects.toThrow('올바르지 않은 ID 값 입니다.');
    });

    it('ID 가 0 이하라면 에러가 발생한다.', async () => {
      // Arrange
      const userId = -1;

      // Act
      jest
        .spyOn(userDb, 'selectById')
        .mockRejectedValueOnce(new Error('올바르지 않은 ID 값 입니다.'));
      const userPoint = () => pointService.getPoint(userId);

      // Assert
      await expect(userPoint).rejects.toThrow('올바르지 않은 ID 값 입니다.');
    });

    it('존재하지 않는 ID 라면 { id: id, point: 0, updateMillis: Date.now() } 가 반환된다', async () => {
      // Arrange
      const userId = 1234;
      const mockUserPoint = { id: userId, point: 0, updateMillis: Date.now() };

      // Act
      jest.spyOn(userDb, 'selectById').mockResolvedValueOnce(mockUserPoint);
      const userPoint = await pointService.getPoint(userId);

      // Assert
      expect(userPoint.id).toBe(userId);
      expect(userPoint.point).toBe(0);
      expect(userPoint).toEqual(mockUserPoint);
    });

    it('유저 포인트가 정상적으로 조회된다.', async () => {
      // Arrange
      const userId = 1;
      const point = 1000;

      // Act
      jest.spyOn(userDb, 'selectById').mockResolvedValueOnce({
        id: userId,
        point,
        updateMillis: Date.now(),
      });
      const userPoint = await pointService.getPoint(userId);

      // Assert
      expect(userPoint.point).toBe(point);
      expect(userDb.selectById).toHaveBeenCalledTimes(1);
      expect(userDb.selectById).toHaveBeenCalledWith(userId);
    });
  });

  describe('포인트 충전/이용 내역 조회', () => {
    /**
     * 시나리오
     * 1.유저 포인트 내역이 정상적으로 조회된다.
     */

    it('유저 포인트 내역이 정상적으로 조회된다.', async () => {
      // Arrange
      const userId = 1;
      const mockHistory = [
        {
          id: 1,
          userId,
          amount: 100,
          type: TransactionType.CHARGE,
          timeMillis: Date.now(),
        },
        {
          id: 2,
          userId,
          amount: 100,
          type: TransactionType.USE,
          timeMillis: Date.now(),
        },
      ];

      // Act
      jest
        .spyOn(historyDb, 'selectAllByUserId')
        .mockResolvedValueOnce(mockHistory);
      const history = await pointService.getHistory(userId);

      // Assert
      expect(history).toHaveLength(2);
      expect(historyDb.selectAllByUserId).toHaveBeenCalledTimes(1);
      expect(historyDb.selectAllByUserId).toHaveBeenCalledWith(userId);
    });
  });

  describe('포인트 충전', () => {
    /**
     * 시나리오
     * 1. 포인트가 정상적으로 충전되어야 한다.
     */

    it('포인트가 정상적으로 충전되어야 한다.', async () => {
      // Arrange
      const userId = 1;
      const point = 1000;
      const newPoint = 500;
      const mockUserPoint = { id: userId, point, updateMillis: Date.now() };
      const mockUpdatedUserPoint = {
        id: userId,
        point: point + newPoint,
        updateMillis: Date.now(),
      };

      const mockPointHistory = {
        id: expect.any(Number),
        userId,
        amount: 500,
        type: TransactionType.CHARGE,
        timeMillis: Date.now(),
      };

      jest.spyOn(userDb, 'selectById').mockResolvedValue(mockUserPoint);
      jest
        .spyOn(userDb, 'insertOrUpdate')
        .mockResolvedValue(mockUpdatedUserPoint);
      jest.spyOn(historyDb, 'insert').mockResolvedValue(mockPointHistory);

      // Act
      const updatedPoint = await pointService.chargePoint(userId, newPoint);

      // Assert
      expect(userDb.selectById).toHaveBeenCalledWith(1);
      expect(userDb.insertOrUpdate).toHaveBeenCalledWith(1, 1500);
      expect(historyDb.insert).toHaveBeenCalledTimes(1);
      expect(updatedPoint.point).toBe(1500);
    });
  });

  describe('포인트 사용', () => {
    /**
     *  시나리오
     *  1. 포인트가 정상적으로 사용되어야 한다.
     *  2. 포인트 사용분이 잔액을 초과할 경우 에러가 발생한다.
     **/

    it('포인트가 정상적으로 사용되어야 한다.', async () => {
      // Arrange
      const userId = 1;
      const point = 1000;
      const usePoint = 500;
      const mockUserPoint = { id: userId, point, updateMillis: Date.now() };
      const mockUpdatedUserPoint = {
        id: userId,
        point: point - usePoint,
        updateMillis: Date.now(),
      };
      const mockPointHistory = {
        id: expect.any(Number),
        userId,
        amount: usePoint,
        type: TransactionType.USE,
        timeMillis: Date.now(),
      };

      jest.spyOn(userDb, 'selectById').mockResolvedValue(mockUserPoint);
      jest
        .spyOn(userDb, 'insertOrUpdate')
        .mockResolvedValue(mockUpdatedUserPoint);
      jest.spyOn(historyDb, 'insert').mockResolvedValue(mockPointHistory);

      // Act
      const updatedUserPoint = await pointService.usePoint(userId, usePoint);

      // Assert
      expect(userDb.selectById).toHaveBeenCalledWith(userId);
      expect(userDb.insertOrUpdate).toHaveBeenCalledWith(
        userId,
        point - usePoint,
      );
      expect(historyDb.insert).toHaveBeenCalledTimes(1);
      expect(updatedUserPoint.point).toBe(500);
    });

    it('포인트 사용분이 잔액을 초과할 경우 에러가 발생한다.', async () => {
      // Arrange
      const userId = 1;
      const point = 500;
      const usePoint = 1000;
      const mockUserPoint = { id: userId, point, updateMillis: Date.now() };

      jest.spyOn(userDb, 'selectById').mockResolvedValue(mockUserPoint);

      // Act
      const updatedUserPoint = () => pointService.usePoint(userId, usePoint);

      // Assert
      await expect(updatedUserPoint()).rejects.toThrow(
        '포인트 잔액이 부족합니다.',
      );
      expect(userDb.selectById).toHaveBeenCalledWith(userId);
      expect(userDb.insertOrUpdate).toHaveBeenCalledTimes(0);
    });
  });
});

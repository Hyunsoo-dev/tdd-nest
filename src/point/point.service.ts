import { BadRequestException, Injectable } from '@nestjs/common';
import { PointHistoryTable } from 'src/database/pointhistory.table';
import { UserPointTable } from 'src/database/userpoint.table';
import { UserPoint, PointHistory, TransactionType } from './point.model';

@Injectable()
export class PointService {
  constructor(
    private readonly userDb: UserPointTable,
    private readonly historyDb: PointHistoryTable,
  ) {}

  // 포인트 조회
  async getPoint(userId: number): Promise<UserPoint> {
    return await this.userDb.selectById(userId);
  }

  // 포인트 충전/이용 내역 조회
  async getHistory(userId: number): Promise<PointHistory[]> {
    return await this.historyDb.selectAllByUserId(userId);
  }

  // 포인트 충전
  async chargePoint(userId: number, amount: number): Promise<UserPoint> {
    // 유저 id 로 포인트 조회
    const userPoint = await this.userDb.selectById(userId);
    const newAmount = amount + userPoint.point;

    // 포인트 생성 혹은 업데이트
    const updatedUserPoint = await this.userDb.insertOrUpdate(
      userId,
      newAmount,
    );

    await this.historyDb.insert(
      userId,
      amount,
      TransactionType.CHARGE,
      Date.now(),
    );

    return updatedUserPoint;
  }

  // 포인트 사용
  async usePoint(userId: number, amount: number): Promise<UserPoint> {
    // 유저 id 로 포인트 조회
    const userPoint = await this.userDb.selectById(userId);
    const newAmount = userPoint.point - amount;
    if (newAmount < 0) {
      throw new BadRequestException('포인트 잔액이 부족합니다.');
    }

    // 포인트 업데이트
    const updatedUserPoint = await this.userDb.insertOrUpdate(
      userId,
      newAmount,
    );
    await this.historyDb.insert(
      userId,
      amount,
      TransactionType.USE,
      Date.now(),
    );

    return updatedUserPoint;
  }
}

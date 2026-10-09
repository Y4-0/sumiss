import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AnalyzerModule } from './analyzer/analyzer.module.js';
import { PrismaService } from './prisma.service.js';

@Module({
  imports: [AnalyzerModule],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { AnalyzerService } from './analyzer.service.js';

@Module({
  providers: [AnalyzerService],
  exports: [AnalyzerService]
})
export class AnalyzerModule {}

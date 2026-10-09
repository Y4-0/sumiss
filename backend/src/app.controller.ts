import { Controller, Get, Post, Delete, Param, UploadedFile, UseInterceptors, Body } from '@nestjs/common';
import { AppService } from './app.service.js';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('messages')
  getMessages() {
    return this.appService.getMessages();
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(@UploadedFile() file: any, @Body('engine') engine: string) {
    if (!file) return { error: 'No file provided' };
    const content = file.buffer.toString('utf-8');
    const filename = file.originalname || 'Unknown_Source.txt';
    return this.appService.processChat(content, filename, engine || 'ollama');
  }

  @Delete('sources/:name')
  deleteSource(@Param('name') name: string) {
    return this.appService.deleteSource(name);
  }
}

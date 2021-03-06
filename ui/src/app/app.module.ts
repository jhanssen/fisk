import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

import { MatCardModule, MatTabsModule, MatListModule, MatInputModule, MatSnackBarModule } from '@angular/material';

import { AppComponent } from './app.component';
import { WebSocketService } from './websocket.service';
import { BackoffService } from './backoff.service';
import { FiskService } from './fisk.service';
import { ConfigService } from './config.service';
import { MessageService } from './message.service';
import { ConfigComponent } from './config/config.component';
import { ChartComponent } from './chart/chart.component';
import { MainComponent } from './main/main.component';
import { LogsComponent } from './logs/logs.component';
import { LogComponent } from './log/log.component';
import { NewChartComponent } from './new-chart/new-chart.component';

const appRoutes: Routes = [
    { path: 'config', component: ConfigComponent },
    { path: 'chart', component: ChartComponent },
    { path: 'new-chart', component: NewChartComponent },
    { path: 'logs', component: LogsComponent },
    { path: 'main', component: MainComponent },
    { path: '', redirectTo: '/main', pathMatch: 'full' }
];

@NgModule({
    declarations: [
        AppComponent,
        ConfigComponent,
        ChartComponent,
        MainComponent,
        LogsComponent,
        LogComponent,
        NewChartComponent
    ],
    imports: [
        BrowserModule,
        BrowserAnimationsModule,
        FormsModule,
        MatCardModule,
        MatTabsModule,
        MatInputModule,
        MatSnackBarModule,
        MatListModule,
        RouterModule.forRoot(appRoutes)
    ],
    providers: [
        WebSocketService,
        BackoffService,
        FiskService,
        ConfigService,
        MessageService
    ],
    bootstrap: [AppComponent]
})
export class AppModule { }

import { Component } from '@angular/core';
import { AncestorChartComponent } from './ancestor-chart/ancestor-chart';

@Component({
  selector: 'app-root',
  imports: [AncestorChartComponent],
  template: `
    <app-ancestor-chart />
  `,
  styleUrl: './app.css',
})
export class App {}

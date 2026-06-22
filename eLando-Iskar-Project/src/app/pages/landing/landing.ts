import { Component } from '@angular/core';
import { Signaling } from '../../services/signaling';

@Component({
  selector: 'app-landing',
  imports: [],
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
})
export class Landing {

  constructor(private signaling: Signaling) { }

  ngOnInit() {
    this.signaling.connect('test-session-1');
    this.signaling.messages$.subscribe(msg => console.log('received', msg));
  }
}

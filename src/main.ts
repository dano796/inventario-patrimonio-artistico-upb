import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig)
  .then((app) => {
    for (const raiz of app.components) raiz.location.nativeElement.removeAttribute('ng-version');
  })
  .catch((err) => console.error(err));

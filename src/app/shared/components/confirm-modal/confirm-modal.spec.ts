import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConfirmModalComponent } from './confirm-modal.component';

describe('ConfirmModalComponent', () => {
  let component: ConfirmModalComponent;
  let fixture: ComponentFixture<ConfirmModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfirmModalComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfirmModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit false when closing modal without confirmation', () => {
    spyOn(component.confirm, 'emit');
    component.closeModal(false);
    expect(component.confirm.emit).toHaveBeenCalledWith(false);
  });

  it('should emit true when confirming action', () => {
    spyOn(component.confirm, 'emit');
    component.closeModal(true);
    expect(component.confirm.emit).toHaveBeenCalledWith(true);
  });

  it('should display custom title when provided', () => {
    const customTitle = 'Custom confirmation message';
    component.title = customTitle;
    component.isOpen = true;
    fixture.detectChanges();

    const titleElement = fixture.nativeElement.querySelector('h3');
    expect(titleElement.textContent.trim()).toBe(customTitle);
  });

  it('should not display modal when isOpen is false', () => {
    component.isOpen = false;
    fixture.detectChanges();

    const modalElement = fixture.nativeElement.querySelector('.fixed');
    expect(modalElement).toBeNull();
  });

  it('should display modal when isOpen is true', () => {
    component.isOpen = true;
    fixture.detectChanges();

    const modalElement = fixture.nativeElement.querySelector('.fixed');
    expect(modalElement).toBeTruthy();
  });
});

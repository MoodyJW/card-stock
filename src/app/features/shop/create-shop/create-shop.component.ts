import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { ShopService } from '../../../core/services/shop.service';
import { ShopContextService } from '../../../core/services/shop-context.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-create-shop',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './create-shop.component.html',
  styleUrl: './create-shop.component.scss',
})
export class CreateShopComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly shopService = inject(ShopService);
  private readonly shopContext = inject(ShopContextService);
  private readonly notify = inject(NotificationService);

  readonly loading = signal(false);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
    slug: ['', [Validators.required, Validators.pattern(/^[a-z0-9][a-z0-9-]{0,30}[a-z0-9]$/)]],
  });

  generateSlug() {
    if (this.form.controls.slug.pristine) {
      const name = this.form.controls.name.value;
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      this.form.controls.slug.setValue(slug);
    }
  }

  async onSubmit() {
    if (this.form.invalid) return;

    this.loading.set(true);

    const { name, slug } = this.form.getRawValue();

    const { data, error } = await this.shopService.createShop({ name, slug });

    if (error) {
      this.loading.set(false);
      this.notify.error(error.message || 'Failed to create shop. Try a different URL.');
      return;
    }

    if (data) {
      await this.shopContext.loadShops();
      this.shopContext.selectShop(data.id);
      this.loading.set(false);
      this.router.navigate(['/shop', data.slug]);
    } else {
      this.loading.set(false);
      this.notify.error('Something went wrong.');
    }
  }
}

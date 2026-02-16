import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ShopService } from '../../../core/services/shop.service';
import { ShopContextService } from '../../../core/services/shop-context.service';
import { Invite, MemberProfile } from '../../../core/models/shop.model';

@Component({
  selector: 'app-team',
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    MatListModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    DatePipe,
    TitleCasePipe,
  ],
  templateUrl: './team.component.html',
  styleUrl: './team.component.scss',
})
export class TeamComponent {
  private readonly shopService = inject(ShopService);
  private readonly shopContext = inject(ShopContextService);
  private readonly fb = inject(FormBuilder);

  readonly currentShopName = computed(() => this.shopContext.currentShop()?.name ?? '');
  readonly members = signal<MemberProfile[]>([]);
  readonly invites = signal<Invite[]>([]);
  readonly loadingMembers = signal(false);
  readonly sendingInvite = signal(false);
  readonly error = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly inviteForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    role: ['member' as 'member' | 'admin', Validators.required],
  });

  constructor() {
    effect(() => {
      const shopId = this.shopContext.currentShop()?.id;
      if (shopId) {
        untracked(() => this.loadData(shopId));
      }
    });
  }

  async loadData(shopId: string) {
    this.loadingMembers.set(true);

    const [membersRes, invitesRes] = await Promise.all([
      this.shopService.getMembers(shopId),
      this.shopService.getInvites(shopId),
    ]);

    if (membersRes.error) console.error('Error loading members:', membersRes.error);
    if (invitesRes.error) console.error('Error loading invites:', invitesRes.error);

    this.members.set((membersRes.data as MemberProfile[]) || []);
    this.invites.set((invitesRes.data as Invite[]) || []);
    this.loadingMembers.set(false);
  }

  async onInvite() {
    if (this.inviteForm.invalid) return;

    const shopId = this.shopContext.currentShop()?.id;
    if (!shopId) return;

    this.sendingInvite.set(true);
    this.error.set(null);
    this.successMessage.set(null);

    const { email, role } = this.inviteForm.getRawValue();

    const { error } = await this.shopService.sendInvite(shopId, email, role);

    if (error) {
      this.error.set(error.message);
    } else {
      this.successMessage.set(`Invite sent to ${email}`);
      this.inviteForm.reset({ role: 'member' });
      await this.loadData(shopId);
    }
    this.sendingInvite.set(false);
  }

  async revokeInvite(inviteId: string) {
    if (!confirm('Are you sure you want to revoke this invite?')) return;

    const shopId = this.shopContext.currentShop()?.id;
    if (!shopId) return;

    const { error } = await this.shopService.revokeInvite(inviteId);

    if (error) {
      this.error.set('Failed to revoke invite');
    } else {
      await this.loadData(shopId);
    }
  }
}

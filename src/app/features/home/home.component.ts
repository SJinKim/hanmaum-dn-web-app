// src/app/features/home/home.component.ts
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { ChartModule } from 'primeng/chart';
import { ChartData, ChartOptions } from 'chart.js';
import { MemberService } from '../members/member.service';
import { MemberSummary, MemberStatus } from '../../core/models/member.model';
import { MinistryService } from '../ministry/ministry.service';

interface StatCard {
  label: string;
  value: string;
  badge: string;
  badgeClass: string;
  icon: string;
  subtext: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [ChartModule, DatePipe],
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit {
  private readonly memberService  = inject(MemberService);
  private readonly ministryService = inject(MinistryService);
  private readonly router          = inject(Router);
  private readonly destroyRef      = inject(DestroyRef);

  readonly loading       = signal(true);
  readonly recentMembers = signal<MemberSummary[]>([]);

  private totalMembers   = signal(0);
  private activeMembers  = signal(0);
  private ministryCount  = signal(0);

  readonly statCards = signal<StatCard[]>([]);

  chartData: ChartData<'line'>;
  chartOptions: ChartOptions<'line'>;

  constructor() {
    const primary   = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim()   || '#2B3A67';
    const secondary = getComputedStyle(document.documentElement).getPropertyValue('--color-secondary').trim() || '#5C6B89';
    const tertiary  = getComputedStyle(document.documentElement).getPropertyValue('--color-tertiary').trim()  || '#8E9AAF';

    this.chartData = {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'],
      datasets: [
        {
          label: '2025',
          data: [820, 932, 901, 934, 1290, 1330, 1320, 1400, 1450, 1520, 1600],
          borderColor: primary,
          backgroundColor: 'rgba(43,58,103,0.05)', // intentional: rgba cannot use CSS vars directly
          borderWidth: 2,
          pointRadius: 3,
          tension: 0.4,
          fill: true,
        },
        {
          label: '2024',
          data: [620, 732, 701, 734, 1090, 1130, 1120, 1200, 1250, 1280, 1350],
          borderColor: tertiary,
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderDash: [4, 4],
          pointRadius: 2,
          tension: 0.4,
        },
      ],
    };

    this.chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { family: 'Manrope', size: 11 }, color: secondary },
        },
      },
      scales: {
        x: { ticks: { font: { family: 'Manrope', size: 10 }, color: tertiary }, grid: { display: false } },
        y: { ticks: { font: { family: 'Manrope', size: 10 }, color: tertiary }, grid: { color: '#f3f4f6' } },
      },
    };
  }

  ngOnInit(): void {
    this.memberService.getMembers({ size: 1 }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => { this.totalMembers.set(res.totalElements); this.refreshStatCards(); },
      error: () => this.loading.set(false),
    });
    this.memberService.getMembers({ status: 'ACTIVE', size: 1 }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => { this.activeMembers.set(res.totalElements); this.refreshStatCards(); },
      error: () => this.loading.set(false),
    });
    this.ministryService.getMinistries().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: list => { this.ministryCount.set(list.length); this.refreshStatCards(); },
      error: () => this.loading.set(false),
    });
    this.memberService.getMembers({ size: 10, sort: 'updatedAt,desc' }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => { this.recentMembers.set(res.content); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  private refreshStatCards(): void {
    this.statCards.set([
      { label: 'TOTAL MEMBERS',    value: this.totalMembers().toLocaleString(),  badge: '+12%',  badgeClass: 'badge-active',   icon: 'pi pi-users',          subtext: 'All registered members'   },
      { label: 'ACTIVE THIS WEEK', value: this.activeMembers().toLocaleString(), badge: '+3%',   badgeClass: 'badge-active',   icon: 'pi pi-check-circle',   subtext: 'Currently active members' },
      { label: 'MINISTRY REQUESTS',value: this.ministryCount().toLocaleString(), badge: 'Total', badgeClass: 'badge-member',   icon: 'pi pi-building',       subtext: 'Ministries registered'    },
      { label: 'AVG. ATTENDANCE',  value: '—',                                   badge: 'N/A',   badgeClass: 'badge-inactive', icon: 'pi pi-calendar-check', subtext: 'Not yet available'        },
    ]);
  }

  statusBadgeClass(status: MemberStatus): string {
    const map: Record<MemberStatus, string> = {
      ACTIVE: 'badge-active', INACTIVE: 'badge-inactive',
      PENDING: 'badge-pending', DELETED: 'badge-deleted',
    };
    return map[status] ?? 'badge-member';
  }

  goToMembers(): void { this.router.navigate(['/members']); }
  goToMember(publicId: string): void { this.router.navigate(['/members', publicId]); }
}

from django.db import models


class Note(models.Model):
    """A single note with optional colour and pin state."""

    class Color(models.TextChoices):
        DEFAULT = 'default', 'پیش‌فرض'
        YELLOW = 'yellow', 'زرد'
        GREEN = 'green', 'سبز'
        BLUE = 'blue', 'آبی'
        PURPLE = 'purple', 'بنفش'
        PINK = 'pink', 'صورتی'

    title = models.CharField('عنوان', max_length=100)
    content = models.TextField('متن', blank=True)
    color = models.CharField(
        'رنگ', max_length=20, choices=Color.choices, default=Color.DEFAULT
    )
    is_pinned = models.BooleanField('سنجاق‌شده', default=False)
    created_at = models.DateTimeField('تاریخ ایجاد', auto_now_add=True)
    updated_at = models.DateTimeField('تاریخ به‌روزرسانی', auto_now=True)

    class Meta:
        ordering = ['-is_pinned', '-updated_at']
        verbose_name = 'یادداشت'
        verbose_name_plural = 'یادداشت‌ها'

    def __str__(self):
        return self.title

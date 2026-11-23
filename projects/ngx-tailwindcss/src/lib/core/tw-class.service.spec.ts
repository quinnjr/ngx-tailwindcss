import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { TwClassService } from './tw-class.service';
import { TW_CONFIG } from './tw-config';
import { provideTwConfig } from './provide-tw-config';

describe('TwClassService', () => {
  describe('without custom config', () => {
    let service: TwClassService;

    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [TwClassService],
      });
      service = TestBed.inject(TwClassService);
    });

    describe('merge()', () => {
      it('should merge multiple class strings', () => {
        const result = service.merge('p-4', 'm-2', 'text-white');
        expect(result).toContain('p-4');
        expect(result).toContain('m-2');
        expect(result).toContain('text-white');
      });

      it('should handle undefined and null values', () => {
        const result = service.merge('p-4', undefined, null, 'm-2');
        expect(result).toBe('p-4 m-2');
      });

      it('should handle false values', () => {
        const result = service.merge('p-4', false, 'm-2');
        expect(result).toBe('p-4 m-2');
      });

      it('should handle empty strings', () => {
        const result = service.merge('p-4', '', 'm-2');
        expect(result).toContain('p-4');
        expect(result).toContain('m-2');
      });

      it('should resolve padding conflicts (later wins)', () => {
        const result = service.merge('p-4', 'p-8');
        expect(result).toBe('p-8');
      });

      it('should resolve margin conflicts', () => {
        const result = service.merge('m-2', 'm-4');
        expect(result).toBe('m-4');
      });

      it('should resolve background color conflicts', () => {
        const result = service.merge('bg-blue-500', 'bg-red-500');
        expect(result).toBe('bg-red-500');
      });

      it('should resolve text color conflicts', () => {
        const result = service.merge('text-white', 'text-black');
        expect(result).toBe('text-black');
      });

      it('should resolve font size conflicts', () => {
        const result = service.merge('text-sm', 'text-lg');
        expect(result).toBe('text-lg');
      });

      it('should resolve display conflicts', () => {
        const result = service.merge('block', 'flex');
        expect(result).toBe('flex');
      });

      it('should resolve position conflicts', () => {
        const result = service.merge('relative', 'absolute');
        expect(result).toBe('absolute');
      });

      it('should resolve width conflicts', () => {
        const result = service.merge('w-full', 'w-1/2');
        expect(result).toBe('w-1/2');
      });

      it('should resolve height conflicts', () => {
        const result = service.merge('h-10', 'h-20');
        expect(result).toBe('h-20');
      });

      it('should resolve border radius conflicts', () => {
        const result = service.merge('rounded', 'rounded-lg');
        expect(result).toBe('rounded-lg');
      });

      it('should resolve shadow conflicts', () => {
        const result = service.merge('shadow', 'shadow-lg');
        expect(result).toBe('shadow-lg');
      });

      it('should handle responsive prefixes separately', () => {
        const result = service.merge('p-4', 'md:p-4', 'md:p-8');
        expect(result).toContain('p-4');
        expect(result).toContain('md:p-8');
        expect(result).not.toContain('md:p-4');
      });

      it('should handle hover prefixes separately', () => {
        const result = service.merge('bg-blue-500', 'hover:bg-blue-500', 'hover:bg-red-500');
        expect(result).toContain('bg-blue-500');
        expect(result).toContain('hover:bg-red-500');
      });

      it('should handle complex prefix combinations', () => {
        const result = service.merge('md:hover:bg-blue-500', 'md:hover:bg-red-500');
        expect(result).toBe('md:hover:bg-red-500');
      });

      it('should preserve non-conflicting classes', () => {
        const result = service.merge('p-4 m-2 text-white bg-blue-500');
        expect(result).toContain('p-4');
        expect(result).toContain('m-2');
        expect(result).toContain('text-white');
        expect(result).toContain('bg-blue-500');
      });

      it('should handle flex properties', () => {
        const result = service.merge('flex-row', 'flex-col');
        expect(result).toBe('flex-col');
      });

      it('should handle justify content', () => {
        const result = service.merge('justify-start', 'justify-center');
        expect(result).toBe('justify-center');
      });

      it('should handle items alignment', () => {
        const result = service.merge('items-start', 'items-center');
        expect(result).toBe('items-center');
      });

      it('should handle z-index', () => {
        const result = service.merge('z-10', 'z-50');
        expect(result).toBe('z-50');
      });

      it('should handle overflow', () => {
        const result = service.merge('overflow-hidden', 'overflow-auto');
        expect(result).toBe('overflow-auto');
      });

      it('should handle visibility', () => {
        const result = service.merge('visible', 'invisible');
        expect(result).toBe('invisible');
      });

      it('should handle opacity', () => {
        const result = service.merge('opacity-50', 'opacity-100');
        expect(result).toBe('opacity-100');
      });

      it('should resolve filter, backdrop filter, object, aspect and order conflicts', () => {
        expect(
          service.merge('absolute inset-0 bg-slate-900/50 backdrop-blur-sm', 'backdrop-blur-none')
        ).toBe('absolute inset-0 bg-slate-900/50 backdrop-blur-none');
        expect(service.merge('backdrop-blur-sm backdrop-opacity-50', 'backdrop-blur-lg')).toBe(
          'backdrop-blur-lg backdrop-opacity-50'
        );
        expect(service.merge('grayscale blur-sm', 'grayscale-0')).toBe('grayscale-0 blur-sm');
        expect(service.merge('object-cover object-center', 'object-contain')).toBe(
          'object-contain object-center'
        );
        expect(service.merge('aspect-video', 'aspect-square')).toBe('aspect-square');
        expect(service.merge('order-1', 'order-last')).toBe('order-last');
      });

      it('should handle transition', () => {
        const result = service.merge('transition', 'transition-all');
        expect(result).toBe('transition-all');
      });

      it('should handle duration', () => {
        const result = service.merge('duration-150', 'duration-300');
        expect(result).toBe('duration-300');
      });

      it('should handle cursor', () => {
        const result = service.merge('cursor-pointer', 'cursor-wait');
        expect(result).toBe('cursor-wait');
      });

      it('should handle font weight', () => {
        const result = service.merge('font-normal', 'font-bold');
        expect(result).toBe('font-bold');
      });

      it('should handle text alignment', () => {
        const result = service.merge('text-left', 'text-center');
        expect(result).toBe('text-center');
      });

      it('should handle text transform', () => {
        const result = service.merge('uppercase', 'lowercase');
        expect(result).toBe('lowercase');
      });

      it('should handle text decoration', () => {
        const result = service.merge('underline', 'no-underline');
        expect(result).toBe('no-underline');
      });

      it('should handle whitespace', () => {
        const result = service.merge('whitespace-normal', 'whitespace-nowrap');
        expect(result).toBe('whitespace-nowrap');
      });

      it('should handle gap', () => {
        const result = service.merge('gap-2', 'gap-4');
        expect(result).toBe('gap-4');
      });

      it('should handle grid columns', () => {
        const result = service.merge('grid-cols-2', 'grid-cols-4');
        expect(result).toBe('grid-cols-4');
      });

      it('should handle ring', () => {
        const result = service.merge('ring-1', 'ring-2');
        expect(result).toBe('ring-2');
      });

      it('should keep ring width, ring offset and ring color separate', () => {
        const result = service.merge(
          'focus-visible:ring-2 focus-visible:ring-offset-2',
          'focus-visible:ring-blue-500'
        );
        expect(result).toBe(
          'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500'
        );
      });

      it('should resolve ring color and ring offset conflicts independently', () => {
        expect(service.merge('ring-blue-500 ring-2', 'ring-red-500')).toBe('ring-red-500 ring-2');
        expect(service.merge('ring-offset-2 ring-offset-white', 'ring-offset-4')).toBe(
          'ring-offset-4 ring-offset-white'
        );
        expect(service.merge('ring', 'ring-4')).toBe('ring-4');
      });

      it('should classify ring arbitrary values, opacity modifiers and ring-inset', () => {
        expect(service.merge('ring-[3px] ring-blue-500/50 ring-inset', 'ring-4')).toBe(
          'ring-4 ring-blue-500/50 ring-inset'
        );
        expect(service.merge('ring-2 ring-blue-500/50', 'ring-[#fff]')).toBe('ring-2 ring-[#fff]');
        expect(service.merge('ring-offset-2', 'ring-offset-[3px]')).toBe('ring-offset-[3px]');
      });

      it('should keep outline width, style, offset and color separate', () => {
        expect(
          service.merge(
            'focus-visible:outline-2 focus-visible:outline-offset-2',
            'focus-visible:outline-blue-500'
          )
        ).toBe(
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'
        );
        expect(service.merge('outline-none ring-2', 'outline-dashed')).toBe(
          'outline-dashed ring-2'
        );
      });

      it('should keep shadow size and shadow color separate', () => {
        expect(service.merge('shadow-lg', 'shadow-slate-900/50')).toBe(
          'shadow-lg shadow-slate-900/50'
        );
        expect(service.merge('shadow-lg shadow-red-500', 'shadow-xl/20')).toBe(
          'shadow-xl/20 shadow-red-500'
        );
      });

      it('should keep side and corner radii separate from the shorthand', () => {
        expect(service.merge('p-4 rounded-lg', 'border-l-4 rounded-l-none')).toBe(
          'p-4 rounded-lg border-l-4 rounded-l-none'
        );
        expect(service.merge('rounded-t-lg rounded-b-none')).toBe('rounded-t-lg rounded-b-none');
        expect(service.merge('rounded-t-lg rounded-bl-sm', 'rounded-md')).toBe('rounded-md');
      });

      it('should keep background color separate from other background utilities', () => {
        expect(
          service.merge(
            'bg-white bg-no-repeat bg-cover bg-center bg-fixed bg-clip-text',
            'bg-black'
          )
        ).toBe('bg-black bg-no-repeat bg-cover bg-center bg-fixed bg-clip-text');
        expect(service.merge('bg-linear-to-r bg-blue-500', 'bg-none')).toBe('bg-none bg-blue-500');
      });

      it('should keep flex grow and shrink separate', () => {
        expect(service.merge('grow shrink-0')).toBe('grow shrink-0');
        expect(service.merge('shrink-0', 'shrink')).toBe('shrink');
      });

      it('should keep text wrapping, overflow and color separate', () => {
        expect(service.merge('text-balance text-ellipsis', 'text-gray-500')).toBe(
          'text-balance text-ellipsis text-gray-500'
        );
        expect(service.merge('text-[14px] text-gray-500', 'text-[0.75rem]')).toBe(
          'text-[0.75rem] text-gray-500'
        );
        expect(service.merge('whitespace-nowrap break-words')).toBe(
          'whitespace-nowrap break-words'
        );
      });

      it('should keep grid placement and table border utilities separate', () => {
        expect(service.merge('col-start-2 col-span-2')).toBe('col-start-2 col-span-2');
        expect(service.merge('justify-between justify-items-center')).toBe(
          'justify-between justify-items-center'
        );
        expect(service.merge('border-collapse border-spacing-2 border-gray-200')).toBe(
          'border-collapse border-spacing-2 border-gray-200'
        );
      });

      it.each([
        // [input, expected] - mirrors tailwind-merge semantics
        ['rounded-lg rounded-t-none', 'rounded-lg rounded-t-none'],
        ['rounded-t-none rounded-lg', 'rounded-lg'],
        ['rounded-tl-none rounded-t-lg', 'rounded-t-lg'],
        ['shadow-none shadow-lg', 'shadow-lg'],
        ['bg-gradient-to-r bg-linear-to-r', 'bg-linear-to-r'],
        ['text-sm/6 text-lg', 'text-lg'],
        [
          'text-[length:var(--x)] text-[color:var(--y)]',
          'text-[length:var(--x)] text-[color:var(--y)]',
        ],
        ['outline-none outline', 'outline-none outline'],
        ['ring ring-0', 'ring-0'],
        ['border-t-2 border-2', 'border-2'],
        ['border-2 border-t-4', 'border-2 border-t-4'],
        ['border border-t-0', 'border border-t-0'],
        ['border-l-2 border-x-4', 'border-x-4'],
        ['border-2 border-dashed', 'border-2 border-dashed'],
        ['border-dashed border-solid', 'border-solid'],
        ['border-[3px] border-[#fff]', 'border-[3px] border-[#fff]'],
        ['border-red-500 border-t-blue-500', 'border-red-500 border-t-blue-500'],
        ['border-t-blue-500 border-red-500', 'border-red-500'],
        [
          'border-separate border-s-2 border-emerald-500',
          'border-separate border-s-2 border-emerald-500',
        ],
        ['p-2 px-4', 'p-2 px-4'],
        ['pl-2 px-4', 'px-4'],
        ['ms-2 mx-4', 'mx-4'],
        ['inset-0 top-2', 'inset-0 top-2'],
        ['top-2 inset-0', 'inset-0'],
        ['top-2 top-4', 'top-4'],
        ['left-2 inset-x-0', 'inset-x-0'],
        ['inset-0 inset-shadow-sm', 'inset-0 inset-shadow-sm'],
        ['w-4 h-4 size-6', 'size-6'],
        ['grid-cols-2 grid-cols-[1fr_2fr]', 'grid-cols-[1fr_2fr]'],
        ['md:hover:p-2 hover:md:p-4', 'hover:md:p-4'],
        ['before:hover:p-2 hover:before:p-4', 'before:hover:p-2 hover:before:p-4'],
        ['-mt-2 mt-4', 'mt-4'],
        ['flex-1 flex-grow-0 grow', 'flex-1 grow'],
        ['hidden table', 'table'],
        // Layout component host defaults vs consumer display overrides
        ['flex hidden', 'hidden'],
        ['inline-flex inline-block', 'inline-block'],
        ['block contents', 'contents'],
        ['flex grid', 'grid'],
        ['flex md:hidden', 'flex md:hidden'],
        ['hidden md:flex', 'hidden md:flex'],
        ['flex hover:block', 'flex hover:block'],
        ['shrink-0 flex flex-1', 'shrink-0 flex flex-1'],
      ])('merges %s -> %s', (input, expected) => {
        expect(service.merge(input)).toBe(expected);
      });

      it('should honor the Tailwind v4 trailing important modifier', () => {
        expect(service.merge('flex!', 'block!')).toBe('block!');
        expect(service.merge('ring-2! ring-blue-500')).toBe('ring-2! ring-blue-500');
      });

      it.each([
        ['!p-2 p-4', '!p-2 p-4'],
        ['p-2! p-4', 'p-2! p-4'],
        ['flex! grid', 'flex! grid'],
        ['!px-2 p-4', '!px-2 p-4'],
        ['!px-2 !p-4', '!p-4'],
        ['!p-2 p-4! ', 'p-4!'],
        ['md:!p-2 md:p-4 md:!p-6', 'md:!p-6 md:p-4'],
        ['!-mt-2 -mt-4 !mt-1', '!mt-1 -mt-4'],
      ])(
        'treats the important modifier as part of the conflict key: %s -> %s',
        (input, expected) => {
          expect(service.merge(input)).toBe(expected);
        }
      );

      it.each([
        [
          'bg-[length:1rem_1rem] bg-[linear-gradient(45deg,transparent_25%,transparent)] bg-blue-500',
          'bg-[length:1rem_1rem] bg-[linear-gradient(45deg,transparent_25%,transparent)] bg-blue-500',
        ],
        ['bg-[url(/a.png)] bg-[image:var(--img)]', 'bg-[image:var(--img)]'],
        ['bg-[position:center] bg-left', 'bg-left'],
        ['shadow-[inset_0_-4px_8px_rgba(0,0,0,0.1)] shadow-inner', 'shadow-inner'],
        ['shadow-lg shadow-[0_0_0_1px_rgba(0,0,0,0.1)]', 'shadow-[0_0_0_1px_rgba(0,0,0,0.1)]'],
      ])('classifies arbitrary background/shadow values: %s -> %s', (input, expected) => {
        expect(service.merge(input)).toBe(expected);
      });

      // Realistic base + variant + override combinations used by library components
      it.each<[string[], string]>([
        [
          [
            'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50',
            'bg-white dark:bg-zinc-800 border-2 border-slate-500 dark:border-zinc-500 hover:border-slate-600 text-slate-800 shadow-sm focus-visible:ring-slate-500',
            'text-sm px-6 py-3 min-h-10',
            '[&_svg]:w-4 [&_svg]:h-4',
            'w-full opacity-50 cursor-not-allowed pointer-events-none',
            'rounded-full px-2',
          ],
          'inline-flex items-center justify-center gap-2 font-medium rounded-full transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 bg-white dark:bg-zinc-800 border-2 border-slate-500 dark:border-zinc-500 hover:border-slate-600 text-slate-800 shadow-sm focus-visible:ring-slate-500 text-sm px-2 py-3 min-h-10 [&_svg]:w-4 [&_svg]:h-4 w-full opacity-50 cursor-not-allowed pointer-events-none',
        ],
        [
          ['block px-6 py-4 border-b border-slate-100 dark:border-slate-700', 'p-2 border-0'],
          'block border-slate-100 dark:border-slate-700 p-2 border-0',
        ],
        [
          [
            'block px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-xl',
            'rounded-none border-t-2 border-blue-500',
          ],
          'block px-6 py-4 border-t-2 border-blue-500 bg-slate-50/50 rounded-none',
        ],
        [
          [
            'flex flex-wrap items-center gap-2 p-2 min-h-10',
            'border border-slate-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500',
            'bg-white dark:bg-slate-800',
            'gap-x-4 border-dashed',
          ],
          'flex flex-wrap items-center gap-2 p-2 min-h-10 border border-slate-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 bg-white dark:bg-slate-800 gap-x-4 border-dashed',
        ],
        [
          [
            'inline-flex items-center px-4 py-2 text-sm font-medium text-white rounded-lg',
            'text-xs text-blue-50',
          ],
          'inline-flex items-center px-4 py-2 text-xs font-medium text-blue-50 rounded-lg',
        ],
        [
          [
            'absolute left-full top-0 ml-1 py-1 min-w-48 shadow-lg dark:shadow-slate-900/50',
            'left-auto right-full ml-0 mr-1',
          ],
          'absolute left-auto top-0 ml-0 py-1 min-w-48 shadow-lg dark:shadow-slate-900/50 right-full mr-1',
        ],
        [
          [
            'rounded-lg bg-white shadow-lg ring-1 ring-black/5 overflow-auto py-1',
            'w-56',
            'overflow-y-scroll',
          ],
          'rounded-lg bg-white shadow-lg ring-1 ring-black/5 overflow-auto py-1 w-56 overflow-y-scroll',
        ],
        [
          ['w-full', 'max-w-4xl', 'mx-auto', 'px-4 sm:px-6 lg:px-8', 'px-0'],
          'w-full max-w-4xl mx-auto px-0 sm:px-6 lg:px-8',
        ],
        [
          [
            'relative h-full border-r last:border-r-0 focus:ring-2 focus:ring-inset focus:ring-blue-400',
            'border-slate-300',
          ],
          'relative h-full border-r last:border-r-0 focus:ring-2 focus:ring-inset focus:ring-blue-400 border-slate-300',
        ],
      ])('preserves intended classes for %j', (input, expected) => {
        expect(service.merge(...input)).toBe(expected);
      });

      it('should handle gradient from', () => {
        const result = service.merge('from-blue-500', 'from-red-500');
        expect(result).toBe('from-red-500');
      });

      it('should handle scale transform', () => {
        const result = service.merge('scale-100', 'scale-105');
        expect(result).toBe('scale-105');
      });

      it('should handle rotate transform', () => {
        const result = service.merge('rotate-0', 'rotate-45');
        expect(result).toBe('rotate-45');
      });

      it('should handle min/max width', () => {
        const resultMin = service.merge('min-w-0', 'min-w-full');
        expect(resultMin).toBe('min-w-full');

        const resultMax = service.merge('max-w-sm', 'max-w-lg');
        expect(resultMax).toBe('max-w-lg');
      });

      it('should handle min/max height', () => {
        const resultMin = service.merge('min-h-0', 'min-h-screen');
        expect(resultMin).toBe('min-h-screen');

        const resultMax = service.merge('max-h-32', 'max-h-64');
        expect(resultMax).toBe('max-h-64');
      });

      it('should handle leading (line-height)', () => {
        const result = service.merge('leading-none', 'leading-relaxed');
        expect(result).toBe('leading-relaxed');
      });

      it('should handle tracking (letter-spacing)', () => {
        const result = service.merge('tracking-tight', 'tracking-wide');
        expect(result).toBe('tracking-wide');
      });

      it('should keep unrecognized classes as unique', () => {
        const result = service.merge('custom-class', 'another-custom');
        expect(result).toContain('custom-class');
        expect(result).toContain('another-custom');
      });

      it('should resolve conflicts with negative values', () => {
        const result = service.merge('mt-4', '-mt-4');
        expect(result).toBe('-mt-4');
      });

      it('should resolve conflicts with important prefix', () => {
        expect(service.merge('!px-2', '!px-4')).toBe('!px-4');
        expect(service.merge('px-2', '!px-4')).toBe('px-2 !px-4');
      });

      it('should let later padding shorthand subsume longhands', () => {
        const result = service.merge('px-2', 'p-4');
        expect(result).toBe('p-4');
      });

      it('should let later margin shorthand subsume longhands', () => {
        const result = service.merge('mx-2', 'my-1', 'm-4');
        expect(result).toBe('m-4');
      });

      it('should keep longhand applied after shorthand', () => {
        const result = service.merge('p-4', 'px-2');
        expect(result).toBe('p-4 px-2');
      });

      it('should subsume prefixed longhands with prefixed shorthand', () => {
        const result = service.merge('md:px-2', 'md:p-4');
        expect(result).toBe('md:p-4');
      });

      it('should handle arbitrary values containing colons', () => {
        const result = service.merge(
          'bg-[url(https://example.com/a.png)]',
          'bg-[url(https://example.com/b.png)]'
        );
        expect(result).toBe('bg-[url(https://example.com/b.png)]');
      });

      it('should handle variants on arbitrary values containing colons', () => {
        const result = service.merge('hover:bg-[url(https://a.io/x.png)]', 'hover:bg-none');
        expect(result).toBe('hover:bg-none');
        // Background image and color are independent utilities
        expect(service.merge('hover:bg-[url(https://a.io/x.png)]', 'hover:bg-red-500')).toBe(
          'hover:bg-[url(https://a.io/x.png)] hover:bg-red-500'
        );
      });

      it('should treat border-x and border-y as border-width', () => {
        const result = service.merge('border-x', 'border-x-2');
        expect(result).toBe('border-x-2');

        const resultY = service.merge('border-y', 'border-y-4');
        expect(resultY).toBe('border-y-4');
      });

      it('should keep border width and border color separate', () => {
        const result = service.merge('border-2', 'border-blue-500');
        expect(result).toContain('border-2');
        expect(result).toContain('border-blue-500');
      });
    });

    describe('conditional()', () => {
      it('should apply classes based on true conditions', () => {
        const result = service.conditional('base-class', {
          'active-class': true,
          'inactive-class': false,
        });
        expect(result).toContain('base-class');
        expect(result).toContain('active-class');
        expect(result).not.toContain('inactive-class');
      });

      it('should handle all false conditions', () => {
        const result = service.conditional('base-class', {
          'class-a': false,
          'class-b': false,
        });
        expect(result).toBe('base-class');
      });

      it('should handle all true conditions', () => {
        const result = service.conditional('base-class', {
          'class-a': true,
          'class-b': true,
        });
        expect(result).toContain('base-class');
        expect(result).toContain('class-a');
        expect(result).toContain('class-b');
      });

      it('should handle undefined conditions as false', () => {
        const result = service.conditional('base-class', {
          'class-a': undefined,
          'class-b': true,
        });
        expect(result).toContain('base-class');
        expect(result).toContain('class-b');
        expect(result).not.toContain('class-a');
      });

      it('should merge conditional classes with conflict resolution', () => {
        const result = service.conditional('p-4', {
          'p-8': true,
        });
        expect(result).toBe('p-8');
      });
    });

    describe('join()', () => {
      it('should join multiple class strings', () => {
        const result = service.join('p-4', 'm-2', 'text-white');
        expect(result).toBe('p-4 m-2 text-white');
      });

      it('should filter out falsy values', () => {
        const result = service.join('p-4', undefined, null, false, 'm-2');
        expect(result).toBe('p-4 m-2');
      });

      it('should return empty string for all falsy values', () => {
        const result = service.join(undefined, null, false);
        expect(result).toBe('');
      });
    });

    describe('getVariantClasses()', () => {
      it('should return empty string for unknown variant', () => {
        const result = service.getVariantClasses('unknown');
        expect(result).toBe('');
      });

      it('should return default variant classes for primary', () => {
        // Default config has theme defined
        const result = service.getVariantClasses('primary');
        expect(result).toContain('bg-blue-600');
      });

      it('should return AA-contrast status defaults matching the components', () => {
        expect(service.getVariantClasses('success')).toContain('bg-emerald-700');
        expect(service.getVariantClasses('info')).toContain('bg-cyan-700');
        expect(service.getVariantClasses('warning')).toContain('text-amber-950');
        expect(service.getVariantClasses('warning')).not.toContain('text-white');
      });
    });
  });

  describe('with custom config', () => {
    let service: TwClassService;

    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [
          provideTwConfig({
            theme: {
              primary: 'bg-purple-600 text-white',
              secondary: 'bg-gray-200 text-gray-800',
            },
          }),
          TwClassService,
        ],
      });
      service = TestBed.inject(TwClassService);
    });

    it('should return configured variant classes', () => {
      const result = service.getVariantClasses('primary');
      expect(result).toBe('bg-purple-600 text-white');
    });

    it('should return secondary variant classes', () => {
      const result = service.getVariantClasses('secondary');
      expect(result).toBe('bg-gray-200 text-gray-800');
    });

    it('should return empty string for unconfigured variant', () => {
      const result = service.getVariantClasses('tertiary');
      expect(result).toBe('');
    });
  });

  describe('with a raw TW_CONFIG partial theme', () => {
    it('should keep default variants that the partial theme omits', () => {
      TestBed.configureTestingModule({
        providers: [{ provide: TW_CONFIG, useValue: { theme: { primary: 'bg-purple-600' } } }],
      });
      const service = TestBed.inject(TwClassService);

      expect(service.getVariantClasses('primary')).toBe('bg-purple-600');
      expect(service.getVariantClasses('danger')).toContain('bg-rose-600');
    });
  });

  describe('axis and property group separation', () => {
    let service: TwClassService;

    beforeEach(() => {
      TestBed.configureTestingModule({ providers: [TwClassService] });
      service = TestBed.inject(TwClassService);
    });

    it('should keep overflow-x and overflow-y independent', () => {
      expect(service.merge('overflow-y-auto overflow-x-hidden')).toBe(
        'overflow-y-auto overflow-x-hidden'
      );
    });

    it('should let the overflow shorthand subsume axis variants', () => {
      expect(service.merge('overflow-x-auto', 'overflow-hidden')).toBe('overflow-hidden');
    });

    it('should keep translate-x and translate-y independent', () => {
      expect(service.merge('translate-x-0 translate-y-0')).toBe('translate-x-0 translate-y-0');
      expect(service.merge('-translate-x-full', 'translate-x-0')).toBe('translate-x-0');
    });

    it('should keep flex direction, wrap, and grow independent', () => {
      expect(service.merge('flex flex-row flex-wrap flex-1')).toBe(
        'flex flex-row flex-wrap flex-1'
      );
      expect(service.merge('flex-row', 'flex-col')).toBe('flex-col');
    });

    it('should keep scroll-behavior separate from non-Tailwind scroll-prefixed classes', () => {
      expect(service.merge('scroll-area-styled scroll-smooth')).toBe(
        'scroll-area-styled scroll-smooth'
      );
      expect(service.merge('scroll-auto', 'scroll-smooth')).toBe('scroll-smooth');
    });

    it('should keep per-side scroll margin/padding independent', () => {
      expect(service.merge('scroll-mt-16 scroll-mb-4')).toBe('scroll-mt-16 scroll-mb-4');
      expect(service.merge('scroll-px-4 scroll-py-2')).toBe('scroll-px-4 scroll-py-2');
      expect(service.merge('scroll-mt-16', 'scroll-mt-20')).toBe('scroll-mt-20');
      expect(service.merge('scroll-mt-16 scroll-ml-2', 'scroll-m-4')).toBe('scroll-m-4');
      expect(service.merge('scroll-pt-2 scroll-pl-2', 'scroll-py-4')).toBe(
        'scroll-pl-2 scroll-py-4'
      );
    });

    it('should keep per-axis skew, 3D rotate and translate-z independent', () => {
      expect(service.merge('skew-x-3 skew-y-6')).toBe('skew-x-3 skew-y-6');
      expect(service.merge('skew-x-3 skew-y-6', 'skew-12')).toBe('skew-12');
      expect(service.merge('rotate-x-45 rotate-y-30 rotate-12')).toBe(
        'rotate-x-45 rotate-y-30 rotate-12'
      );
      expect(service.merge('translate-x-2 translate-z-4')).toBe('translate-x-2 translate-z-4');
      expect(service.merge('scale-z-50', 'scale-75')).toBe('scale-75');
    });

    it('should keep pointer-events, select, and resize independent', () => {
      expect(service.merge('pointer-events-none select-none resize-none')).toBe(
        'pointer-events-none select-none resize-none'
      );
    });
  });

  describe('utility catalog (Tailwind v4)', () => {
    let service: TwClassService;

    beforeEach(() => {
      TestBed.configureTestingModule({ providers: [TwClassService] });
      service = TestBed.inject(TwClassService);
    });

    // Pairs that set different CSS properties: both must be kept
    const independent: ReadonlyArray<[string, string]> = [
      // Layout
      ['block', 'relative'],
      ['absolute', 'inset-0'],
      ['top-0', 'left-0'],
      ['inset-x-0', 'inset-y-2'],
      ['inset-s-0', 'inset-e-4'],
      ['top-0', 'inset-s-0'],
      ['inset-bs-0', 'inset-be-2'],
      ['overflow-x-auto', 'overflow-y-hidden'],
      ['z-10', 'visible'],
      ['inset-0', 'inset-shadow-sm'],
      // Flexbox & grid
      ['flex', 'flex-1'],
      ['flex-row', 'flex-wrap'],
      ['grow', 'shrink-0'],
      ['basis-1/2', 'flex-none'],
      ['justify-between', 'justify-items-center'],
      ['items-center', 'self-start'],
      ['content-center', 'place-items-center'],
      ['gap-x-2', 'gap-y-4'],
      ['grid-cols-3', 'grid-rows-2'],
      ['col-span-2', 'col-start-1'],
      ['row-span-2', 'row-end-3'],
      // Spacing
      ['px-4', 'py-2'],
      ['pt-2', 'pb-4'],
      ['ps-2', 'pe-4'],
      ['pbs-2', 'pbe-4'],
      ['mx-auto', 'my-4'],
      ['mbs-2', 'mt-4'],
      ['space-x-4', 'space-x-reverse'],
      ['space-y-2', 'space-y-reverse'],
      ['space-x-2', 'space-y-4'],
      // Sizing
      ['w-full', 'h-10'],
      ['min-w-0', 'max-w-md'],
      ['min-h-screen', 'max-h-96'],
      // Typography
      ['text-sm', 'text-gray-700'],
      ['text-(length:--size)', 'text-red-500'],
      ['text-left', 'text-white'],
      ['text-white', 'text-shadow-md'],
      ['text-shadow-lg', 'text-shadow-sky-300'],
      ['truncate', 'text-gray-500'],
      ['font-bold', 'font-sans'],
      ['font-sans', 'font-stretch-condensed'],
      ['font-mono', 'font-features-["smcp"]'],
      ['leading-tight', 'tracking-wide'],
      ['uppercase', 'underline'],
      ['whitespace-nowrap', 'break-all'],
      // Backgrounds
      ['bg-red-500', 'bg-cover'],
      ['bg-white', 'bg-[url(/a.png)]'],
      ['bg-(image:--hero)', 'bg-slate-900'],
      ['bg-center', 'bg-no-repeat'],
      ['bg-linear-to-r', 'bg-blue-500'],
      ['bg-fixed', 'bg-clip-text'],
      ['from-indigo-500', 'from-10%'],
      ['via-sky-500', 'via-30%'],
      ['to-emerald-500', 'to-90%'],
      ['from-red-500', 'to-blue-500'],
      // Borders
      ['border', 'border-gray-200'],
      ['border-2', 'border-dashed'],
      ['border-t', 'border-b'],
      ['border-t-2', 'border-t-red-500'],
      ['border-bs', 'border-red-500'],
      ['border-bs-2', 'border-be-4'],
      ['border-collapse', 'border-spacing-2'],
      ['border-spacing-x-2', 'border-spacing-y-4'],
      ['rounded-t-lg', 'rounded-b-none'],
      ['rounded-lg', 'border'],
      ['ring-2', 'ring-blue-500'],
      ['ring-offset-2', 'ring-offset-white'],
      ['ring', 'ring-inset'],
      ['outline-2', 'outline-offset-2'],
      ['outline-dashed', 'outline-red-500'],
      // Effects & filters
      ['shadow-lg', 'shadow-black/20'],
      ['shadow-md', 'opacity-50'],
      ['blur-sm', 'backdrop-blur-sm'],
      // Transitions & animation
      ['transition-colors', 'duration-200'],
      ['transition-all', 'transition-discrete'],
      ['ease-in-out', 'delay-100'],
      ['animate-spin', 'transition'],
      // Transforms
      ['scale-x-50', 'scale-y-75'],
      ['rotate-45', 'rotate-x-12'],
      ['translate-x-2', 'translate-y-4'],
      ['skew-x-3', 'skew-y-6'],
      ['origin-top', 'scale-95'],
      // Interactivity
      ['cursor-pointer', 'select-none'],
      ['pointer-events-none', 'resize-none'],
      ['scroll-smooth', 'scroll-mt-4'],
      ['scroll-pt-2', 'scroll-pbs-4'],
      ['scroll-mx-2', 'scroll-my-4'],
    ];

    // Pairs that set the same CSS property: the later class must win
    const conflicting: ReadonlyArray<[string, string, string?]> = [
      ['block', 'hidden'],
      ['relative', 'absolute'],
      ['top-0', 'top-4'],
      ['start-0', 'inset-s-4'],
      ['inset-s-0 inset-bs-0', 'inset-0'],
      ['inset-bs-0', 'inset-y-2'],
      ['overflow-x-auto', 'overflow-hidden'],
      ['z-10', 'z-20'],
      ['flex-row', 'flex-col'],
      ['justify-start', 'justify-end'],
      ['gap-x-2 gap-y-4', 'gap-2'],
      ['col-span-1', 'col-span-2'],
      ['pt-2 pbs-2', 'p-4'],
      ['pbs-2', 'py-4'],
      ['mbe-2', 'm-4'],
      ['space-x-reverse', 'space-x-reverse'],
      ['w-4', 'w-8'],
      ['text-sm', 'text-lg'],
      ['text-sm', 'text-(length:--size)'],
      ['text-red-500', 'text-blue-500'],
      ['text-shadow-sm', 'text-shadow-lg'],
      ['text-shadow-red-500', 'text-shadow-blue-500'],
      ['font-sans', 'font-mono'],
      ['font-stretch-condensed', 'font-stretch-expanded'],
      ['bg-red-500', 'bg-blue-500'],
      ['bg-[url(/a.png)]', 'bg-(image:--hero)'],
      ['from-10%', 'from-20%'],
      ['from-red-500', 'from-blue-500'],
      ['border-t-2 border-bs-4', 'border-2'],
      ['border-be-2', 'border-y-4'],
      ['border-bs-red-500', 'border-blue-500'],
      ['border-spacing-x-2 border-spacing-y-4', 'border-spacing-2'],
      ['rounded-tl-lg', 'rounded-none'],
      ['ring-2', 'ring-4'],
      ['shadow-sm', 'shadow-lg'],
      ['transition-discrete', 'transition-normal'],
      ['transition-colors', 'transition-all'],
      ['duration-100', 'duration-300'],
      ['scale-x-50', 'scale-75'],
      ['skew-x-3', 'skew-12'],
      ['translate-x-2 translate-y-2', 'translate-4'],
      ['scroll-mbs-2', 'scroll-m-4'],
      ['scroll-pbe-2', 'scroll-py-4'],
      ['outline-red-500', 'outline-blue-500'],
    ];

    it.each(independent)('keeps both %s and %s', (first, second) => {
      expect(service.merge(first, second)).toBe(`${first} ${second}`);
    });

    it.each(conflicting)('lets %s be overridden by %s', (first, second) => {
      expect(service.merge(first, second)).toBe(second);
    });
  });
});

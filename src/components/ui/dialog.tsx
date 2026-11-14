import { useTabTintProps } from '@/components/oau/tab-tint';
import { Icon } from '@/components/ui/icon';
import { NativeOnlyAnimatedView } from '@/components/ui/native-only-animated-view';
import { useSkin } from '@/lib/skin';
import { cn } from '@/lib/utils';
import * as DialogPrimitive from '@rn-primitives/dialog';
import { X } from 'lucide-react-native';
import * as React from 'react';
import { Platform, Text, View, type GestureResponderEvent, type ViewProps } from 'react-native';
import { FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated';
import { FullWindowOverlay as RNFullWindowOverlay } from 'react-native-screens';

const Dialog = DialogPrimitive.Root;

/**
 * OAU's windows: paper with an ink outline and rounder corners, over a warm
 * ink dim, the title in Halant on the website (LavenderBookStyle,
 * oau-style-guide.md, section 13.17). Other skins are untouched.
 */
const OAU_CONTENT = 'rounded-[24px] border-[1.5px] border-outline-ink';
const OAU_DIM = 'bg-[rgba(69,49,30,0.28)]';
const OAU_TITLE = 'font-oau-display text-oau-heading';

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const FullWindowOverlay = Platform.OS === 'ios' ? RNFullWindowOverlay : React.Fragment;

function DialogOverlay({
  className,
  children,
  onPress,
  ...props
}: Omit<React.ComponentProps<typeof DialogPrimitive.Overlay>, 'asChild'> & {
  children?: React.ReactNode;
}) {
  const { onOpenChange } = DialogPrimitive.useRootContext();

  function onOverlayPress(event: GestureResponderEvent) {
    onPress?.(event);
    if (event.target === event.currentTarget && !event.isDefaultPrevented()) {
      onOpenChange(false);
    }
  }

  return (
    <FullWindowOverlay>
      <DialogPrimitive.Overlay
        className={cn(
          'absolute bottom-0 left-0 right-0 top-0 flex items-center justify-center bg-black/50 p-2',
          Platform.select({
            web: 'animate-in fade-in-0 fixed cursor-default [&>*]:cursor-auto',
          }),
          className
        )}
        {...props}
        onPress={Platform.select({ web: onOverlayPress, native: onPress })}
        asChild={Platform.OS !== 'web'}>
        <NativeOnlyAnimatedView
          entering={FadeIn.duration(200).reduceMotion(ReduceMotion.System)}
          exiting={FadeOut.duration(150).reduceMotion(ReduceMotion.System)}
          as="Pressable">
          <NativeOnlyAnimatedView
            entering={FadeIn.delay(50).reduceMotion(ReduceMotion.System)}
            exiting={FadeOut.duration(150).reduceMotion(ReduceMotion.System)}>
            <>{children}</>
          </NativeOnlyAnimatedView>
        </NativeOnlyAnimatedView>
      </DialogPrimitive.Overlay>
    </FullWindowOverlay>
  );
}
function DialogContent({
  className,
  portalHost,
  children,
  style,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  portalHost?: string;
}) {
  const oau = useSkin().skin === 'oau';
  // Read here, in the tab, before the window leaves it for the portal host:
  // OAU's tab colours, so "Got it" in My Account is pink, not the Map's blue.
  const tint = useTabTintProps();
  return (
    <DialogPortal hostName={portalHost}>
      <DialogOverlay className={oau ? OAU_DIM : undefined}>
        <DialogPrimitive.Content
          className={cn(
            'bg-background border-border z-50 mx-auto flex w-full max-w-[calc(100%-2rem)] flex-col gap-4 rounded-lg border p-6 shadow-lg shadow-black/5 sm:max-w-lg',
            oau && OAU_CONTENT,
            oau && tint.className,
            Platform.select({
              web: 'animate-in fade-in-0 zoom-in-95 duration-200',
            }),
            className
          )}
          // A phone only: the tint is a class on the website.
          style={oau && tint.style ? [tint.style, style] : style}
          {...props}>
          <>{children}</>
          <DialogPrimitive.Close
            className={cn(
              'absolute right-4 top-4 rounded opacity-70 active:opacity-100',
              Platform.select({
                web: 'ring-offset-background focus:ring-ring data-[state=open]:bg-accent transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2',
              })
            )}
            hitSlop={12}>
            <Icon
              as={X}
              className={cn('text-accent-foreground web:pointer-events-none size-4 shrink-0')}
            />
            <Text className="sr-only">Close</Text>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogOverlay>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: ViewProps) {
  return (
    <View className={cn('flex flex-col gap-2 text-center sm:text-left', className)} {...props} />
  );
}

function DialogFooter({ className, ...props }: ViewProps) {
  return (
    <View
      className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  );
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  const oau = useSkin().skin === 'oau';
  return (
    <DialogPrimitive.Title
      className={cn(
        'text-foreground text-lg font-semibold leading-none',
        oau && OAU_TITLE,
        className
      )}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};

import { urlToBase64, processReactionString } from '@discordeno/utils'
import { expect } from 'chai'
import { describe, it } from 'mocha'
import { e2ecache, rest } from './utils.js'

before(async () => {
  if (!e2ecache.guild) {
    e2ecache.guild = await rest.createGuild({
      name: 'Discordeno-test',
    })
  }
})

after(async () => {
  if (rest.invalidBucket.timeoutId) clearTimeout(rest.invalidBucket.timeoutId)
  if (e2ecache.guild.id && !e2ecache.deletedGuild) {
    e2ecache.deletedGuild = true
    await rest.deleteGuild(e2ecache.guild.id)
  }
})

describe('Send a message', () => {
  it('With content', async () => {
    const message = await rest.sendMessage('1041029705790402611', { content: 'testing rate limit manager' })
    expect(message.content).to.be.equal('testing rate limit manager')

    const edited = await rest.editMessage(message.channelId, message.id, { content: 'testing rate limit manager edited' })
    expect(message.content).to.be.not.equal(edited.content)

    await rest.deleteMessage(message.channelId, message.id)
  })

  it('With an image', async () => {
    const image = await fetch('https://cdn.discordapp.com/avatars/270010330782892032/d031ea881688526d1ae235fd2843e53c.jpg?size=2048')
      .then(async (res) => await res.blob())
      .catch(() => undefined)
    expect(image).to.not.be.undefined
    if (!image) throw new Error('Was not able to fetch the image.')

    const message = await rest.sendMessage('1041029705790402611', { file: { blob: image, name: 'gamer' } })
    expect(message.attachments.length).to.be.greaterThan(0)
    const [attachment] = message.attachments

    expect(attachment.filename).to.be.equal('gamer')
  })
})

describe('Manage reactions', async () => {
  it('Add and delete a unicode reaction', async () => {
    const reactionChannel = await rest.createChannel(e2ecache.guild.id, { name: 'reactions' })
    const message = await rest.sendMessage(reactionChannel.id, { content: 'add reaction test' })

    await rest.addReaction(message.channelId, message.id, '📙')
    const reacted = await rest.getMessage(message.channelId, message.id)
    expect(reacted.reactions?.length).to.be.greaterThanOrEqual(1)

    await rest.deleteOwnReaction(message.channelId, message.id, '📙')
    const unreacted = await rest.getMessage(message.channelId, message.id)
    // Use boolean comparison because when its 0 length discord sends undefined
    expect(!!unreacted.reactions?.length).to.be.equal(false)
  })

  it('Add and delete a custom reaction', async () => {
    const emoji = await rest.createEmoji(e2ecache.guild.id, {
      name: 'discordeno',
      image: await urlToBase64('https://cdn.discordapp.com/emojis/785403373817823272.webp?size=96'),
    })
    const emojiCode = `<:${emoji.name!}:${emoji.id!}>`

    const reactionChannel = await rest.createChannel(e2ecache.guild.id, { name: 'reactions' })
    const message = await rest.sendMessage(reactionChannel.id, { content: 'add reaction test' })

    await rest.addReaction(message.channelId, message.id, emojiCode)
    const reacted = await rest.getMessage(message.channelId, message.id)
    expect(reacted.reactions?.length).to.be.greaterThanOrEqual(1)

    const reactions = await rest.getReactions(reactionChannel.id, message.id, processReactionString(emojiCode))
    expect(reactions?.length).to.be.greaterThanOrEqual(1)

    await rest.deleteOwnReaction(message.channelId, message.id, emojiCode)
    const unreacted = await rest.getMessage(message.channelId, message.id)
    // Use boolean comparison because when its 0 length discord sends undefined
    expect(!!unreacted.reactions?.length).to.be.equal(false)
  })

  it('Add several reactions with random order and delete all of them', async () => {
    const emoji = await rest.createEmoji(e2ecache.guild.id, {
      name: 'discordeno',
      image: await urlToBase64('https://cdn.discordapp.com/emojis/785403373817823272.webp?size=96'),
    })
    const emojiCode = `<:${emoji.name!}:${emoji.id!}>`

    const reactionChannel = await rest.createChannel(e2ecache.guild.id, { name: 'reactions' })
    const message = await rest.sendMessage(reactionChannel.id, { content: 'add reaction test' })

    await rest.addReactions(message.channelId, message.id, [emojiCode, '📙'])
    const reacted = await rest.getMessage(message.channelId, message.id)
    expect(reacted.reactions?.length).to.be.greaterThanOrEqual(1)

    await rest.deleteReactionsAll(message.channelId, message.id)
    const unreacted = await rest.getMessage(message.channelId, message.id)
    // Use boolean comparison because when its 0 length discord sends undefined
    expect(!!unreacted.reactions?.length).to.equal(false)
  })

  it('Add several reactions in an order and delete emoji reaction', async () => {
    const emoji = await rest.createEmoji(e2ecache.guild.id, {
      name: 'discordeno',
      image: await urlToBase64('https://cdn.discordapp.com/emojis/785403373817823272.webp?size=96'),
    })
    const emojiCode = `<:${emoji.name!}:${emoji.id!}>`

    const reactionChannel = await rest.createChannel(e2ecache.guild.id, { name: 'reactions' })
    const message = await rest.sendMessage(reactionChannel.id, { content: 'add reaction test' })

    await rest.addReactions(message.channelId, message.id, [emojiCode, '📙'], true)
    const reacted = await rest.getMessage(message.channelId, message.id)
    expect(reacted.reactions?.length).to.be.greaterThanOrEqual(1)

    await rest.deleteReactionsEmoji(message.channelId, message.id, emojiCode)
    const unreacted = await rest.getMessage(message.channelId, message.id)
    expect(unreacted.reactions?.length).to.greaterThanOrEqual(1)

    await rest.deleteUserReaction(message.channelId, message.id, rest.applicationId.toString(), '📙')
    const noreacted = await rest.getMessage(message.channelId, message.id)
    // Use boolean comparison because when its 0 length discord sends undefined
    expect(!!noreacted.reactions?.length).to.equal(false)
  })
})

describe('Rate limit manager testing', () => {
  it('Send 10 messages to 1 channel', async () => {
    const channel = await rest.createChannel(e2ecache.guild.id, { name: 'rate-limit-1' })
    await Promise.all(
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(async (i) => {
        await rest.sendMessage(channel.id, { content: `10 messages to 1 channel testing rate limit manager ${i}` })
      }),
    )
  })

  it('Send 10 messages to 10 channels', async () => {
    await Promise.all(
      [...Array(10).keys()].map(async () => {
        const channel = await rest.createChannel(e2ecache.guild.id, { name: 'rate-limit-x' })

        await Promise.all(
          [...Array(10).keys()].map(async (_, index) => {
            await rest.sendMessage(channel.id, { content: `testing rate limit manager ${index}` })
          }),
        )
      }),
    )
  })
})

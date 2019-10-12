import { nexusPrismaPlugin } from '@generated/nexus-prisma'
import { Photon } from '@generated/photon'
import { idArg, makeSchema, objectType, stringArg } from 'nexus'
import { ApolloServer } from 'apollo-server-micro'
import { join } from 'path'
import { Context } from './types'


const photon = new Photon()

const nexusPrisma = nexusPrismaPlugin({
  photon: (ctx: Context) => ctx.photon,
})

const User = objectType({
  name: 'User',
  definition(t) {
    t.model.id()
    t.model.name()
    t.model.email()
    t.model.posts({
      pagination: false,
    })
  },
})

const Post = objectType({
  name: 'Post',
  definition(t) {
    t.model.id()
    t.model.createdAt()
    t.model.updatedAt()
    t.model.title()
    t.model.content()
    t.model.published()
    t.model.author()
  },
})

const Query = objectType({
  name: 'Query',
  definition(t) {
    t.crud.post({
      alias: 'post',
    })

    t.list.field('feed', {
      type: 'Post',
      resolve: (_, args, ctx) => {
        return ctx.photon.posts.findMany({
          where: { published: true },
        })
      },
    })

    t.list.field('filterPosts', {
      type: 'Post',
      args: {
        searchString: stringArg({ nullable: true }),
      },
      resolve: (_, { searchString }, ctx) => {
        return ctx.photon.posts.findMany({
          where: {
            OR: [
              { title: { contains: searchString } },
              { content: { contains: searchString } },
            ],
          },
        })
      },
    })
  },
})

const Mutation = objectType({
  name: 'Mutation',
  definition(t) {
    t.crud.createOneUser({ alias: 'signupUser' })
    t.crud.deleteOnePost()

    t.field('createDraft', {
      type: 'Post',
      args: {
        title: stringArg(),
        content: stringArg({ nullable: true }),
        authorEmail: stringArg(),
      },
      resolve: (_, { title, content, authorEmail }, ctx) => {
        return ctx.photon.posts.create({
          data: {
            title,
            content,
            published: false,
            author: {
              connect: { email: authorEmail },
            },
          },
        })
      },
    })

    t.field('publish', {
      type: 'Post',
      nullable: true,
      args: {
        id: idArg(),
      },
      resolve: (_, { id }, ctx) => {
        return ctx.photon.posts.update({
          where: { id },
          data: { published: true },
        })
      },
    })
  },
})

const schema = makeSchema({
  types: [Query, Mutation, Post, User, nexusPrisma],
  outputs: {
    typegen: join(__dirname, '../typings/generated/index.d.ts'),
  },
  typegenAutoConfig: {
    sources: [
      {
        source: '@generated/photon',
        alias: 'photon',
      },
      {
        source: join(__dirname, 'types.ts'),
        alias: 'ctx',
      },
    ],
    contextType: 'ctx.Context',
  },
})


 const apolloServer = new ApolloServer({
  schema,
  context: (request: any) => {
    //从HTTP Headers处，取出token{"Authorization": "Bearer $token"}
    let token = ''
    //console.log('request->'+JSON.stringify(request))
    // if (request.req.headers.authorization != null) {
    //   token = request.req.headers.authorization.replace('Bearer ', '')
    // }
    return {
      photon,
      token
    }
  },
  formatError: error => {
    let extensions: { [key: string]: any } = { code: error.extensions != undefined ? error.extensions['code'] : 'INTERNAL_SERVER_ERROR' }
    if (extensions.code == 'INTERNAL_SERVER_ERROR') {
      console.log(`INTERNAL_SERVER_ERROR:${JSON.stringify(error)}`)
    }
    return {
      message: error.message,
      locations: error.locations,
      path: error.path,
      extensions
    }
  }
})

export default apolloServer.createHandler({ path: '/' })
